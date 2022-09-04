import {CLIOptions, build, Configuration} from 'aurelia-cli';
import * as gulp from 'gulp';
import * as project from '../aurelia.json';
import * as htmlmin from 'gulp-htmlmin';
import * as gulpIf from 'gulp-if';
import * as plumber from 'gulp-plumber';

import * as marked from 'gulp-marked';
import * as insert from 'gulp-insert';
import * as lazypipe from 'lazypipe';

const buildOptions = new Configuration(project.build.options);
const minify = buildOptions.isApplicable('minify');


// const isMarkdownFile = f => f.extname === '.md';
function isMarkdownFile(f) {
	let result = f.extname === '.md';
	// console.log("isMarkdownFile: " + f.path + " -> " + result);

	if(result) {
		// if(f.path.includes("hello.md"))
		// 	console.log("isMarkdownFile2: " + f.path + " -> " + result + ", contents: " + f.contents);

		let asfd = marked({});
		let ad = asfd._transform(f, null, () => {
			// console.log("marked done: " + f.contents);
		});

		let wra = insert.wrap('<template>', '</template>');
		wra._transform(f, null, () => {
			if(f.path.includes("hello.md"))
				console.log("wrap done: " + f.contents);
		});
	}

	return;
}

// process markdown in GitHub Flavored Markdown
// wrap the result in <template> tag
function processMarkdown() {
	// console.log("processMarkdown!!");
	////// la pipe ne fonctionne pas, jsp pourquoi. ça ne fait rien, juste passthrough. 
	/// mais les fonctions de transform fonctionnent en les appelant manuellement dans isMarkdownFile
	let pipe = lazypipe()
	.pipe(marked, {gfm: true})
	.pipe(insert.wrap, '<template>', '</template>');
	return pipe();
}

export default function processMarkup() {

  return gulp.src(project.markupProcessor.source, {sourcemaps: true, since: gulp.lastRun(processMarkup)})
//   return gulp.src(project.markupProcessor.source)

  // add conditional markdown processing right after changedInPlace check
  	.pipe(gulpIf(isMarkdownFile, processMarkdown()))

    .pipe(gulpIf(CLIOptions.hasFlag('watch'), plumber()))
    .pipe(gulpIf(minify, htmlmin({
        // collapseInlineTagWhitespace: true,
        // collapseBooleanAttributes: true,
        // removeAttributeQuotes: true,
        // removeScriptTypeAttributes: true,
        // removeStyleLinkTypeAttributes: true,
        removeComments: true,
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true,
        ignoreCustomFragments: [/\${.*?}/g] // ignore interpolation expressions
    })))
    .pipe(build.bundle());
}

