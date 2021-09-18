const { NodePackageManager, NpmAccess, TypeScriptProject } = require('projen');
const project = new TypeScriptProject({
  authorEmail: 'harold@pwrdrvr.com',
  authorName: 'Harold Hunt',
  authorOrganization: 'PwrDrvr LLC',
  copyrightOwner: 'PwrDrvr LLC',
  copyrightPeriod: '2020',
  defaultReleaseBranch: 'main',
  license: 'MIT',
  name: '@pwrdrvr/serverless-nextjs-router',
  npmAccess: NpmAccess.PUBLIC,
  packageManager: NodePackageManager.NPM,
  minNodeVersion: '12.0.0',
  npmRegistryUrl: 'https://npm.pkg.github.com',
  npmTokenSecret: 'NPM_TOKEN',
  releaseToNpm: true,
  description:
    'Enables running `serverless-next.js` applications using Origin Lamdbda functions for reduced cost and improved speed.',
  keywords: ['serverless', 'next.js', 'lamda', 'aws', 'serverless-next.js'],

  eslintOptions: {
    prettier: true,
  },

  repository: 'git://github.com/pwrdrvr/serverless-nextjs-router.git',

  tsconfig: {
    compilerOptions: {
      // DOM is needed when specifying `lib` to avoid Blob and ReadableStream errors
      // on `node_modules/@aws-sdk/client-s3/S3Client.ts:631:60` like:
      // - error TS2304: Cannot find name 'Blob'.
      // - error TS2304: Cannot find name 'ReadableStream'.
      // https://github.com/microsoft/TypeScript/issues/14897
      lib: ['es2018', 'dom'],
      skipLibCheck: true,
      esModuleInterop: true,
    },
  },

  devDeps: [
    '@rollup/plugin-commonjs@^17.1.0',
    '@rollup/plugin-json@^4.1.0',
    '@rollup/plugin-node-resolve@^11.2.0',
    '@types/aws-lambda@^8.10.72',
    '@types/lambda-log@^2.2.0',
    'rollup@^2.39.0',
    'rollup-plugin-node-externals@^2.2.0',
    'rollup-plugin-terser@^7.0.2',
    'rollup-plugin-typescript2@^0.30.0',
  ],

  deps: [
    '@aws-sdk/client-s3@^3.32.0',
    '@aws-sdk/middleware-retry@^3.32.0',
    '@aws-sdk/smithy-client@^3.32.0',
    'get-stream@^6.0.0',
    'lambda-log@^2.4.0',
  ],

  // scripts: {
  //   'compile': 'rollup --config  && tsc -p tsconfig.build.json',
  //   'cloc': 'cloc --exclude-dir=node_modules,.storybook,.serverless,.serverless_nextjs,.next,storybook-static,dist --exclude-ext=json .'
  // },

  // postBuildSteps: [
  //   { run }
  // ]

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
  // release: undefined,      /* Add release management to this project. */
});

// We have to override the default build as we need a very specific rollup with deps
// and WITHOUT the underlying app .js files from serverless-next.js
project.compileTask.exec('rm -rf lib/ && rollup --config  && tsc -p tsconfig.build.json');

project.synth();
