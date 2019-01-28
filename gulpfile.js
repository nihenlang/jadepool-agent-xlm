let gulp = require('gulp')
let del = require('del')
let ts = require('gulp-typescript')
let tsp = ts.createProject('tsconfig.json') //使用tsconfig.json文件配置tsc

function clean () {
  return del(['dist/*'])
}
clean.displayName = 'clean:dist'

function build () {
  return gulp.src(['./src/**/*.ts'])
    .pipe(tsp())
    .pipe(gulp.dest('./dist'))
}
build.displayName = 'build:ts'

function copy () {
  return gulp.src(['./src/**/*.js', './src/**/*.json'])
    .pipe(gulp.dest('./dist'))
}
copy.displayName = 'copy:js|json'

exports.build = build
exports.default = gulp.series(clean, build, copy)
