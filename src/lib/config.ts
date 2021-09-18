export interface IConfig {
  region: string;
  s3BucketName: string;
  s3DomainName: string;
}

export class Config implements IConfig {
  private static _instance: Config;
  public static get instance(): IConfig {
    if (Config._instance === undefined) {
      Config._instance = new Config();
    }
    return Config._instance;
  }

  private _region: string;
  private _s3BucketName: string;
  private _s3DomainName: string;

  private constructor() {
    this._region = process.env.AWS_REGION || 'MicroApps';
    this._s3BucketName = process.env.S3BUCKETNAME || 'MicroApps';
    this._s3DomainName = '';
    const regionInfix = this._region === 'us-east-1' ? '' : `${this._region}.`;
    this._s3DomainName = `${this._s3BucketName}.s3.${regionInfix}amazonaws.com`;
  }

  public static get envLevel(): 'dev' | 'qa' | 'prod' | 'local' {
    const nodeEnv = process.env.NODE_ENV || 'dev';
    if (nodeEnv.startsWith('prod')) {
      return 'prod';
    } else if ((nodeEnv as string) === 'qa') {
      return 'qa';
    } else if ((nodeEnv as string) === 'local') {
      return 'local';
    }
    return 'dev';
  }

  public get region(): string {
    return this._region;
  }

  public get s3BucketName(): string {
    return this._s3BucketName;
  }

  public get s3DomainName(): string {
    return this._s3DomainName;
  }
}
