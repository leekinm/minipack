import fs from 'fs';
import ejs from 'ejs';
import path from 'path';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import { transformFromAstSync } from '@babel/core';
import chalk from 'chalk';

function makeDirectoryIfNotExist(dirName = 'dist') {
	const dirPath = path.resolve(process.cwd(), '..', dirName);
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath);
	}
	return dirPath;
}

// 模块唯一标识
let id = 1;

function createAssets(filePath) {
	// 1.读取文件，获取源代码
	const source = fs.readFileSync(filePath, { encoding: 'utf-8' });

	// 2.将源代码生成AST
	// 为什么要设置{sourceType:'module'}，因为：'import' and 'export' may appear only with 'sourceType: "module"'
	const ast = parser.parse(source, { sourceType: 'module' });

	// 3.遍历AST，依赖收集
	const deps = [];
	traverse.default(ast, {
		ImportDeclaration({ node }) {
			deps.push(node.source.value);
		}
	});

	// 4.将AST转换成require的方式引入外部文件
	const { code } = transformFromAstSync(ast, null, { presets: ['env'] });
	/**
   * 比如这样
    {
      filePath: './src/main.js',
      code: 'import { foo } from "./foo.js";\n' +
        '\n' +
        'function main() {\n' +
        '  console.log("main");\n' +
        '  foo();\n' +
        '}\n' +
        '\n' +
        'main();\n',
      deps: [ './foo.js' ]
    }
   */
	return {
		id: id++,
		mapping: {},
		code,
		deps
	};
}

// 创建资源关系图
function createGraph(entryPath) {
	// 从入口开始创建依赖关系图
	const entryAsset = createAssets(entryPath);

	// 深度遍历
	// TODO: 处理循环引用
	const queue = [entryAsset];
	for (const asset of queue) {
		asset.deps.forEach((relativePath) => {
			const child = createAssets(path.resolve(relativePath));
			asset.mapping[relativePath] = child.id;
			queue.push(child);
		});
	}

	return queue;
}

// 构建
function build(entryPath) {
	const graph = createGraph(entryPath);

	const data = graph.map((asset) => ({
		id: asset.id,
		code: asset.code,
		mapping: asset.mapping
	}));

	// 读取模板，将源代码插入到指定位置
	const template = fs.readFileSync('./template.ejs', { encoding: 'utf-8' });
	const source = ejs.render(template, { data });

	// 生成bundle.js
	const distPath = makeDirectoryIfNotExist();
	const distFile = path.resolve(distPath, 'bundle.js');
	fs.writeFileSync(distFile, source);
	console.log('恭喜！打包任务已经构建完成！');
	console.log('\n' + distFile);
}

console.log('\n打包任务正在构建中，请稍后...');
build('./main.js');
