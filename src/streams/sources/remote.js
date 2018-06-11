'use strict';

var stream, util, request, env;

stream  = require('stream');
util    = require('util');
request = require('request');
env     = require('../../config/environment_vars');


function Remote(image){
  /* jshint validthis:true */
  if (!(this instanceof Remote)){
    return new Remote(image);
  }
  stream.Readable.call(this, { objectMode : true });
  this.image = image;
  this.ended = false;

  // set the expiry value to the shorter value
  this.image.expiry = env.IMAGE_EXPIRY_SHORT;
}

util.inherits(Remote, stream.Readable);

Remote.prototype._read = function(){
  var _this = this,
      url;

  if ( this.ended ){ return; }

  // pass through if there is an error on the image object
  if (this.image.isError()){
    this.ended = true;
    this.push(this.image);
    return this.push(null);
	}
	url = decodeURIComponent(this.image.path);

  this.image.log.time('source:Remote');

  var opts = {
    url: url,
    encoding: null,
    headers: {
      'User-Agent': env.USER_AGENT
    }
  };

  request(opts, function (err, response, body) {
    _this.image.log.timeEnd('source:Remote');

    if (err) {
      _this.image.error = err;
    }
    else {
      if (response.statusCode === 200) {
        _this.image.contents = body;
        _this.image.originalContentLength = body.length;
        _this.ended = true;
      }
      else {
        _this.image.error = new Error('[' + response.statusCode + '] Remote user image not found ('+url+')');
        _this.image.error.statusCode = 404;
      }
    }

    _this.push(_this.image);
    _this.push(null);
  });

};


module.exports = Remote;
