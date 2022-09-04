import {FrameworkConfiguration} from 'aurelia-framework';
import {ViewEngine, customElement, inlineView} from 'aurelia-framework';
import commonmark, { HtmlRenderer, Parser } from 'commonmark';
import lazypipe from 'lazypipe';


// var jsHintTasks = lazypipe();

// function fn(arg: string) {
// 	console.log("fn: " + arg);
// }

export function configure(config: FrameworkConfiguration): void {
  //config.globalResources([]);

//   let laz = new lazypipe();
//   console.log("resource configuration");
//   lazypipe();
  //.pipe(fn("hi"));
//   console.log("lazypipe=" + asd);

//   let viewEngine = config.container.get(ViewEngine);
//   let loader = config.aurelia.loader;

//   console.log("resource configuration viewengine: " + viewEngine);

//   viewEngine.addResourcePlugin('.md', {
// 	'fetch': function(address) {
// 		return loader.loadText(address).then(markdown => {
// 			let elementName = address.replace('.md', '');
// 			let index = elementName.lastIndexOf('/');

// 			if (index != 0) {
// 				elementName = elementName.substring(index + 1);
// 			}

// 			return { [elementName]: createMarkdownElement(elementName, markdown) };
// 		});
// 	 }
//   });

}


// var reader = new Parser();
// var writer = new HtmlRenderer();



// function getHtml(markdown) {
//     return writer.render(reader.parse(markdown));
// }

// function createMarkdownElement(name, markdown) {
//     let markup = getHtml(markdown);
//     let template = '<template>${markup}</template>'


//     @customElement(name)
//     @inlineView(template)
//     class MarkdownElement { }

//     return MarkdownElement;
// }
