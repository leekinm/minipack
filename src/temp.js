/*
  演变1：直接将模块的代码拷贝到目标文件
  存在的问题：变量会相互影响覆盖，各个模块之间没有独立作用域
*/
// main.js模块
// import { foo } from "./foo.js";
// function main() {
//   console.log("main");
//   foo();
// }
// main();

// foo.js模块
// export function foo() {
//   console.log("foo");
// }

/*
  演变2：将每个模块的代码用一个函数包裹住，解决了[演变1]中模块没有独立作用域的问题
  存在的问题：import、export在函数作用域中使用，导致报错，因为它们只能在文件的最顶层作用域中使用
*/
// mainjs
// function mainjs() {
//   import { foo } from "./foo.js";
//   function main() {
//     console.log("main");
//     foo();
//   }
//   main();
// }

// function foojs() {
//   export function foo() {
//     console.log("foo");
//   }
// }

/*
  演变3：我们可不可以将import、export(default) "翻译成" Commonjs的require导入导出方式呢？答案是可以的，
  思路是：自己提供一个require方法，内部实现模块的导入导出。由于module.exports或者exports本质上，还是导出的一个对象
  然后外部使用时，调用该对象上的方法就可以了

  实现require的一个关键几步：
    1.如何通过给定的filePath，查找对应的模块呢？答案是建立一个路径与文件映射的关系
    2.这个require需要返回模块内部的接口，以供外部调用
*/

// function require(filePath) {
//   const map = {
//     "./src/foo.js": foojs,
//     "./src/main.js": mainjs,
//   };
//   const fn = map[filePath];
//   const module = {
//     exports: {},
//   };
//   fn(require, module, module.exports);
//   return module.exports;
// }

// require("./src/main.js");

// 这里为什么要通过传参的方式调用require，而不是直接调用呢？
// 因为注意到foojs中是通过module.exports的方式导出值的，直接调用require是没法直接获取导出的值的
// function mainjs(require, module, exports) {
//   const { foo } = require("./foo.js"); // import { foo } from "./foo.js";
//   function main() {
//     console.log("main");
//     foo();
//   }
//   main();
// }

// function foojs(require, module, exports) {
//   function foo() {
//     console.log("foo");
//   }
//   module.exports = { foo }; // export function foo() { console.log("foo"); }
// }

/*
  演变4：整理一下代码，加入自执行函数
  存在的问题：因为modules对应的key是一个相对路径，会导致依赖文件相互覆盖的问题，所以需要换一种思路
  其实我们可以通过Id去搜寻模块，这样不存在文件相互覆盖的问题，因为id对应的是每一个资源且唯一
*/
// (function (modules) {
//   function require(filePath) {
//     const fn = modules[filePath];
//     const module = {
//       exports: {},
//     };
//     fn(require, module, module.exports);
//     return module.exports
//   }
//   require("./src/main.js");
// })({
//   "./src/main.js": function (require, module, exports) {
//     const { foo } = require("./foo.js"); // import { foo } from "./foo.js";
//     function main() {
//       console.log("main");
//       foo();
//     }
//     main();
//   },
//   "./src/foo.js": function (require, module, exports) {
//     function foo() {
//       console.log("foo");
//     }
//     module.exports = { foo }; // export function foo() { console.log("foo"); }
//   },
// });

/*
  演变5：采用模块id去映射每一个模块，避免模块冲突等问题，具体做法是：
  通过一个id对应一个数组的方式，数组的第一项放置模块源码，数组第二项存放该模块的依赖关系
  先通过id查找到对应模块，然后再从依赖关系中找出该模块依赖的模块Id，通过该id就可以找到对应模块了，以此类推
*/
(function (modules) {
	function require(id) {
		const [fn, mapping] = modules[id];
		function localRequire(filePath) {
			const id = mapping(filePath);
			return require(id);
		}
		const module = {
			exports: {}
		};
		fn(localRequire, module, module.exports);
		return module.exports;
	}
	require(1);
})({
	1: [
		function (require, module, exports) {
			const { foo } = require('./foo.js'); // import { foo } from "./foo.js";
			function main() {
				console.log('main');
				foo();
			}
			main();
		},
		{ './src/foo.js': 2 }
	],
	2: [
		function (require, module, exports) {
			function foo() {
				console.log('foo');
			}
			module.exports = { foo }; // export function foo() { console.log("foo"); }
		},
		{}
	]
});

/*
  演变6：观察演变5里的这个自执行函数可以发现，经常需要变动的地方就是1 2...也就是源码是经常需要替换的，
  所以就联想到模板这个东西，提供不常变的部分，经常变更的部分动态插入就可以了，可以通过字符串拼接的方式，或者ejs模板实现，如下：
*/
// ;(function (modules) {
//   function require(id) {
//     const [fn, mapping] = modules[id];
//     function localRequire(filePath) {
//       const id = mapping[filePath];
//       return require(id);
//     }
//     const module = {
//       exports: {},
//     };
//     fn(localRequire, module, module.exports);
//     return module.exports
//   }
//   require(1);
// })({
//   // 这里的部分就是经常需要替换的
//   <% data.forEach(item => {%>
//     "<%- item.id %>": [function(require, module, exports) {
//       <%- item.code %>
//     },<%- JSON.stringify(item.mapping) %>],
//   <% }); %>
// });
