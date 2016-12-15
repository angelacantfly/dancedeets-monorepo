
// This gulpfile makes use of new JavaScript features.
// Babel handles this without us having to do anything. It just works.
// You can read more about the new JavaScript features here:
// https://babeljs.io/docs/learn-es2015/

import del from 'del';
import favicons from 'gulp-favicons';
import gutil from 'gutil';
import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import runSequence from 'run-sequence';
import { output as pagespeed } from 'psi';
import username from 'username';
import taskListing from 'gulp-task-listing';

gulp.task('help', taskListing);

const $ = gulpLoadPlugins();

const baseAssetsDir = `/Users/${username.sync()}/Dropbox/dancedeets/art/build-assets/`;

gulp.task('compile:images:favicons', () => gulp
  .src('assets/img/deets-head.png')
  .pipe(favicons({
    appName: 'DanceDeets',
    appDescription: 'Street Dance Events. Worldwide.',
    developerName: 'DanceDeets',
    developerURL: 'http://www.dancedeets.com/',
    background: '#fff',
    path: '/dist/img/favicons/',
    url: 'http://www.dancedeets.com/',
    display: 'standalone',
    orientation: 'portrait',
    version: 1.0,
    logging: false,
    online: true,
    icons: {
      opengraph: false,
      twitter: false,
    },
    html: './dist/templates/favicon_tags.html',
    replace: true,
  }))
  .on('error', gutil.log)
  .pipe(gulp.dest('./dist/img/favicons/'))
);

gulp.task('compile:images:resize', () => gulp
  .src(`${baseAssetsDir}img/**/*.{png,jpg}`)
  .pipe($.responsiveImages({
    'classes/*/*.*': [{
      width: 32,
      height: 32,
      format: 'png',
    }],
    '{location,style}-*.jpg': [{
      width: 450,
      height: 300,
      crop: 'true',
      quality: 60,
    }],
    'deets-activity-*.png': [{
      height: 100,
    }],
    'background*.jpg': [{
      width: 1200,
      quality: 60,
      suffix: '@2x',
    }, {
      width: 600,
      quality: 60,
    }],
    'deets-head-and-title-on-black.png': [{
      height: 64 * 2,
      suffix: '@2x',
    }, {
      height: 64,
    }, {
      height: 60,
      suffix: '-60px',
    }],
    'fb-login.png': [
    {},
    ],
  }))
  .pipe($.imagemin({
    progressive: true,
    interlaced: true,
  }))
  .pipe(gulp.dest('dist/img'))
);

// gets deets-activity svg files
gulp.task('compile:images:svg', () => gulp
  .src(`${baseAssetsDir}img/*.svg`)
  .pipe($.cache($.imagemin({
    progressive: true,
    interlaced: true,
  })))
  .pipe(gulp.dest('dist/img'))
);

gulp.task('compile:images', ['compile:images:favicons', 'compile:images:resize', 'compile:images:svg']);

gulp.task('compile:fonts', () => gulp
  .src('bower_components/font-awesome/fonts/*.*')
    .pipe(gulp.dest('dist/fonts/'))
);

// Run PageSpeed Insights
gulp.task('pagespeed', cb =>
  // Update the below URL to the public URL of your site
  pagespeed('http://www.dancedeets.com/new_homepage', {
    strategy: 'mobile',
    // By default we use the PageSpeed Insights free (no API key) tier.
    // Use a Google Developer API key if you have one: http://goo.gl/RkN0vE
    // key: 'YOUR_API_KEY'
  }, cb)
);

gulp.task('generate-amp-sources', $.shell.task(['./amp/generate_amp_sources.py']));

function webpack(configName, dependencies = []) {
  const webpackCommand = `node_modules/webpack/bin/webpack.js --color --progress --config webpack.config.${configName}.babel.js`;
  gulp.task(`compile:webpack:${configName}`, dependencies, $.shell.task([webpackCommand]));
  gulp.task(`compile:webpack:${configName}-watch`, dependencies, $.shell.task([`${webpackCommand} --watch`]));
  gulp.task(`compile-debug:webpack:${configName}`, dependencies, $.shell.task([`${webpackCommand} --debug`]));
  gulp.task(`compile-debug:webpack:${configName}-watch`, dependencies, $.shell.task([`${webpackCommand} --watch --debug`]));
}
// Generate rules for our three webpack configs
webpack('amp', ['generate-amp-sources']);
webpack('server');
webpack('client');

gulp.task('compile:code', ['compile:webpack:amp', 'compile:webpack:server', 'compile:webpack:client']);

gulp.task('compile', ['compile:code', 'compile:images', 'compile:fonts']);

gulp.task('clean', () => del.sync('dist'));

gulp.task('test', $.shell.task(['./nose.sh']));

gulp.task('clean-build-test', (callback) => {
  runSequence('clean', 'compile', 'test', callback);
});


gulp.task('datalab:start', $.shell.task(['gcloud app modules start datalab --version main']));
gulp.task('datalab:stop',  $.shell.task(['gcloud app modules stop  datalab --version main']));
gulp.task('datalab', ['datalab:start']);


gulp.task('dev-appserver:create-yaml:hot', $.shell.task(['HOT=1 ./create_devserver_yaml.sh']));
gulp.task('dev-appserver:create-yaml:regular', $.shell.task(['./create_devserver_yaml.sh']));

gulp.task('dev-appserver:wait-for-exit', $.shell.task(['./wait_for_dev_appserver_exit.sh']));

function startDevAppServer() {
  return gulp.src('app-devserver.yaml')
    .pipe($.gaeImproved('dev_appserver.py', {
      port: 8080,
      storage_path: '~/Projects/dancedeets-storage/',
      runtime: 'python-compat',
    }));
}
gulp.task('dev-appserver:server:regular', ['dev-appserver:create-yaml:regular', 'dev-appserver:wait-for-exit'], startDevAppServer);
gulp.task('dev-appserver:server:hot',     ['dev-appserver:create-yaml:hot',     'dev-appserver:wait-for-exit'], startDevAppServer);


// TODO: 'compile:webpack:amp' will probably fail, since it needs a server to run against.
//       We will need a server running alongside, for this deployment to work.
// Someday we may want something more elaborate like:
// https://github.com/gulpjs/gulp/blob/master/docs/recipes/automate-release-workflow.md
gulp.task('deploy', ['clean-build-test'], $.shell.task(['./deploy.sh']));

gulp.task('react-server', $.shell.task(['../runNode.js ./node_server/renderServer.js']));

// Workable Dev Server (1): Hot reloading
// Port 8090: Backend React Render server
gulp.task('hot-server:react', ['react-server']);
// Port 8080: Middle Python server.
gulp.task('hot-server:python', ['dev-appserver:server:hot']);
// Port 9090: Frontend Javascript Server (Handles Hot Reloads and proxies the rest to Middle Python)
gulp.task('hot-server:javascript', $.shell.task(['../runNode.js ./hotServer.js --debug']));
// Or we can run them all with:
gulp.task('hot-server', ['hot-server:react', 'hot-server:python', 'hot-server:javascript']);


// Workable Dev Server (2) Prod-like JS/CSS setup
// Port 8090: Backend React Render server
gulp.task('server:react', ['react-server']);
// Port 8080: Frontend Python server
gulp.task('server:python', ['dev-appserver:server:regular']);
// Also need to run the three webpack servers:
//    'compile:webpack:amp-watch'
//    'compile:webpack:server-watch'
//    'compile:webpack:client-watch'
// Or we can run them all with:
gulp.task('server', ['server:react', 'server:python', 'compile:webpack:server-watch', 'compile:webpack:client-watch']);
// TODO: We ignore 'compile:webpack:amp-watch' because it will need a running server to run against, and timing that is hard.
