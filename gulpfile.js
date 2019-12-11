
var gulp     = require('gulp'),
    jshint   = require('gulp-jshint'),
    jsonlint = require("gulp-jsonlint"),
    sass     = require('gulp-sass'),
    karma    = require('karma'),
    zip      = require('gulp-zip');

var sources = {
  js: [
    'src/**/*.js',
    '!**/lib/**'
  ],
  json: [
    'src/_locales/**/*.json'
  ],
  sass: [
    'src/options/options.scss'
  ],
  dist: [
    'src/**',
    '!**/*.scss'
  ]
};

// Default Karma configuration.
var karmaConfig = {
  browsers: ['FirefoxHeadless'],
  customLaunchers: {
    FirefoxHeadless: {
      base: 'Firefox',
      flags: [ '-headless' ],
    },
  },
  frameworks: [ 'jasmine' ],
  singleRun: true
};

function watchFiles () {
  gulp.watch(sources.js, lintTask);
  gulp.watch(sources.json, jsonlintTask);
  gulp.watch(sources.sass, sassTask);
}

function sassTask () {
  return gulp.src(sources.sass)
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('src/options/'));
}

function lintTask () {
  return gulp.src(sources.js)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
}

function jsonlintTask () {
  return gulp.src(sources.json)
    .pipe(jsonlint())
    .pipe(jsonlint.reporter());
}

function testTask (done) {
  // background/helpers.js
  new karma.Server(Object.assign(karmaConfig, {
    files: [
      'test/background/webex-mocks.js',
      'src/background/helpers.js',
      'test/background/helpers.spec.js'
    ]
  }), exitCode => {
    done();

    // https://github.com/karma-runner/karma/issues/1035
    // Note: can't chain tasks after this.
    process.exit();
  }).start();
}

function distTask () {
  return gulp.src(sources.dist)
    .pipe(zip('foxygestures.xpi', {
      compress: false
    }))
    .pipe(gulp.dest('dist'));
}

exports.sass = sassTask;
exports.lint = lintTask;
exports.jsonlint = jsonlintTask;
exports.test = testTask;
exports.dist = distTask;

exports.watch = gulp.series(sassTask, watchFiles);
exports.default = gulp.series(gulp.parallel(lintTask, jsonlintTask, sassTask), watchFiles);