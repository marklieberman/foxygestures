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

gulp.task('default', [ 'lint', 'jsonlint', 'sass', 'watch' ]);

gulp.task('watch', [ 'sass' ], function () {
  gulp.watch(sources.js, [ 'lint' ]);
  gulp.watch(sources.json, [ 'jsonlint' ]);
  gulp.watch(sources.sass, [ 'sass' ]);
});

gulp.task('sass', function () {
  gulp.src(sources.sass)
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('src/options/'));
});

gulp.task('lint', function () {
  return gulp.src(sources.js)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('jsonlint', function () {
  return gulp.src(sources.json)
    .pipe(jsonlint())
    .pipe(jsonlint.reporter());
});

gulp.task('test', function (done) {
  // background/helpers.js
  new karma.Server(Object.assign(karmaConfig, {
    files: [
      'test/background/webex-mocks.js',
      'src/background/helpers.js',
      'test/background/helpers.spec.js'
    ]
  }), done).start();
});

gulp.task('dist', [ 'sass' ], function () {
  return gulp.src(sources.dist)
    .pipe(zip('foxygestures.xpi', {
      compress: false
    }))
    .pipe(gulp.dest('dist'));
});
