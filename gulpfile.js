var gulp   = require('gulp'),
    jshint = require('gulp-jshint'),
    sass   = require('gulp-sass'),
    zip    = require('gulp-zip');

var sources = {
  js: [
    'src/**/*.js',
    '!**/lib/**'
  ],
  sass: [
    'src/options/options.scss'
  ],
  dist: [
    'src/**',
    '!**/*.scss'
  ]
};

gulp.task('default', [ 'watch' ]);

gulp.task('watch', function () {
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

gulp.task('dist', function () {
  return gulp.src(sources.dist)
    .pipe(zip('foxygestures.xpi'))
    .pipe(gulp.dest('dist'));
});
