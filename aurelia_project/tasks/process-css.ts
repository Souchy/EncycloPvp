import {CLIOptions, build} from 'aurelia-cli';
import * as gulp from 'gulp';
import * as project from '../aurelia.json';
import * as gulpIf from 'gulp-if';
import * as plumber from 'gulp-plumber';
import * as less from 'gulp-less';

export default function processCSS() {
  return gulp.src(project.cssProcessor.source, {sourcemaps: true})
    .pipe(gulpIf(CLIOptions.hasFlag('watch'), plumber()))
    .pipe(less())
    .pipe(build.bundle());
}

