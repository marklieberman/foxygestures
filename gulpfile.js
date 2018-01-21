var gulp     = require('gulp'),
    jshint   = require('gulp-jshint'),
    jsonlint = require("gulp-jsonlint");
    sass     = require('gulp-sass'),
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

gulp.task('default', [ 'lint', 'sass', 'watch' ]);

gulp.task('watch', [ 'sass' ], function () {
  gulp.watch(sources.js, [ 'lint' ]);
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

gulp.task('dist', [ 'sass' ], function () {
  return gulp.src(sources.dist)
    .pipe(zip('foxygestures.xpi'))
    .pipe(gulp.dest('dist'));
});
