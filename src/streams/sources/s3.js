'use strict';

var env, s3, stream, util, client, bucket;

env    = require('../../config/environment_vars');
s3     = require('aws-sdk').S3;
stream = require('stream');
util   = require('util');

try {
	var project_config = include('projects.json');
} catch(e) {
	var project_config = require('../../../projects.json');
}


function s3Stream(image, project){
  if (project) {
    var project_setting = project_config.projects[project];
    try {
      // create an AWS S3 client with the config data
      var client_options = {
        accessKeyId: project_setting.AWS_ACCESS_KEY_ID,
        secretAccessKey: project_setting.AWS_SECRET_ACCESS_KEY,
        region: project_setting.AWS_REGION
      }
      if (project_setting.AWS_ENDPOINT) {
        client_options['endpoint'] = project_setting.AWS_ENDPOINT;
      }
      if (project_setting.AWS_SIGNATURE) {
        client_options['signatureVersion'] = project_setting.AWS_SIGNATURE;
      }
      client = new s3(client_options);
      bucket = project_setting.S3_BUCKET;
    } catch(e) {
      console.log('some error: ', e);
    }
  } else {
    try {
      // create an AWS S3 client with the config data
      var client_options = {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        region: env.AWS_REGION
      }
      if (env.AWS_ENDPOINT) {
        client_options['endpoint'] = env.AWS_ENDPOINT;
      }
      client = new s3(client_options);
      bucket = env.S3_BUCKET;
    } catch(e) {}
  }

  /* jshint validthis:true */
  if (!(this instanceof s3Stream)){
    return new s3Stream(image);
  }
  stream.Readable.call(this, { objectMode : true });
  this.image = image;
  this.ended = false;
}

util.inherits(s3Stream, stream.Readable);

s3Stream.prototype._read = function(){
  var _this = this;

  if ( this.ended ){ return; }

  // pass through if there is an error on the image object
  if (this.image.isError()){
    this.ended = true;
    this.push(this.image);
    return this.push(null);
  }

  // Set the AWS options
  var awsOptions = {
    Bucket: bucket,
    Key: this.image.path.replace(/^\//,'')
  };

  this.image.log.time('source:s3');

  if (!awsOptions.Key) {
    this.image.log.timeEnd('source:s3');

    this.image.error = new Error('Empty object key');
    this.image.error.statusCode = 404;

    this.ended = true;
    this.push(this.image);
    return this.push(null);
  }

  client.getObject(awsOptions, function(err, data){
    _this.image.log.timeEnd('source:s3');

    // if there is an error store it on the image object and pass it along
    if (err) {
      _this.image.error = err;
    }

    // if not store the image buffer
    else {
      _this.image.contents = data.Body;
      _this.image.originalContentLength = data.Body.length;
    }

    _this.ended = true;
    _this.push(_this.image);
    _this.push(null);
  });
};


module.exports = s3Stream;
