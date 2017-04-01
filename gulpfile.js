var gulp   = require('gulp'),
    jshint = require('gulp-jshint'),
    zip    = require('gulp-zip');

var sources = {
  js: [
    'src/**/*.js',
    '!**/lib/**'
  ]
};

gulp.task('default', [ 'watch' ]);

gulp.task('watch', function () {
  gulp.watch(sources.js, [ 'lint' ]);
});

gulp.task('lint', function () {
  return gulp.src(sources.js)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('dist', function () {
  return gulp.src('src/**')
    .pipe(zip('foxygestures.xpi'))
    .pipe(gulp.dest('dist'));
});
