let gulp = require('gulp')
let del = require('del')
let ts = require('gulp-typescript')
let tsp = ts.createProject('tsconfig.json') //使用tsconfig.json文件配置tsc

gulp.task('clean:dist', cb => {
  del(['dist/*'], cb)
})

gulp.task('build:ts', () => {
  return gulp.src(['./src/**/*.ts'])
    .pipe(tsp())
    .pipe(gulp.dest('./dist'))
})

gulp.task('copy:js|json', () => {
  return gulp.src(['./src/**/*.js', './src/**/*.json'])
    .pipe(gulp.dest('./dist'))
})

gulp.task('default', ['clean:dist', 'build:ts', 'copy:js|json'])
