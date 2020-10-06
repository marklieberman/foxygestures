'use strict';

describe("background/helper.js", function() {

  var helpers;

  beforeEach(function () {
    helpers = modules.helpers;
  });

  it("should suggest filenames for normal URLs", function() {
    // Return null so the browser can guess the filename.
    expect(helpers.suggestFilename('https://www.example.com/'))
      .toEqual({ name: '', ext: '' });

    // Simple URLs with normal features.
    expect(helpers.suggestFilename('https://www.example.com/example.html'))
      .toEqual({ name: 'example', ext: '.html' });

    expect(helpers.suggestFilename('https://www.example.com/example.html?q=search'))
      .toEqual({ name: 'example', ext: '.html' });
    expect(helpers.suggestFilename('https://www.example.com/example.html?q=search#anchor'))
      .toEqual({ name: 'example', ext: '.html' });
    expect(helpers.suggestFilename('https://www.example.com/example.html#anchor'))
      .toEqual({ name: 'example', ext: '.html' });
    expect(helpers.suggestFilename('https://www.example.com/example.jpg'))
      .toEqual({ name: 'example', ext: '.jpg' });
    expect(helpers.suggestFilename('https://www.example.com/subdir/example.jpg'))
      .toEqual({ name: 'example', ext: '.jpg' });
    expect(helpers.suggestFilename('https://www.example.com/subdir/example'))
      .toEqual({ name: 'example', ext: '' });
    expect(helpers.suggestFilename('https://www.example.com/subdir/video.mp4'))
      .toEqual({ name: 'video', ext: '.mp4' });

    // Simple URLs with characters that are not valid for paths.
    expect(helpers.suggestFilename('https://www.example.com/bad:file.txt'))
      .toEqual({ name: 'bad file', ext: '.txt' });
    expect(helpers.suggestFilename('https://www.example.com/bad%3Ffile.txt'))
      .toEqual({ name: 'bad file', ext: '.txt' });

    // Examples from #251 - trailing text after extension.
    expect(helpers.suggestFilename('https://pbs.twimg.com/media/Deh3bIAXUAAfyxP.jpg:large'))
      .toEqual({ name: 'Deh3bIAXUAAfyxP', ext: '.jpg' });    

    // Examples from #261 - repeated dots in filename.
    expect(helpers.suggestFilename('https://www.example.com/string01.string02_string03.jpg'))
      .toEqual({ name: 'string01.string02_string03', ext: '.jpg' });
    expect(helpers.suggestFilename('https://www.example.com/string01.string02/string03.string04_string05.jpg'))
      .toEqual({ name: 'string03.string04_string05', ext: '.jpg' });

    // Video with no extension but mime-type is known.
    expect(helpers.suggestFilename('https://www.example.com/sample_video', 'video/webm'))
      .toEqual({ name: 'sample_video', ext: '.webm' });
  });
 
  it("should suggest filenames for data: URLs", function() {
    // No mime-type should default to text.
    expect(helpers.suggestFilename('data:,Hello%2C%20World!'))
      .toEqual({ name: 'data', ext: '.txt' });

    // Known mime-types should get valid extensions.
    expect(helpers.suggestFilename('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D'))
      .toEqual({ name: 'data', ext: '.txt' });
    expect(helpers.suggestFilename('data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E'))    
      .toEqual({ name: 'data', ext: '.html' });
    expect(helpers.suggestFilename('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'))
      .toEqual({ name: 'data', ext: '.gif' });
    expect(helpers.suggestFilename('data:application/octet-stream;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'))
      .toEqual({ name: 'data', ext: '.bin' });

    // Unknown mime type defaults to .bin
    expect(helpers.suggestFilename('data:unknown/mime;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'))
      .toEqual({ name: 'data', ext: '.bin' });
  });

  it("should suggest filenames and handle invalid URLs", function() {
    // URL contains an invalid escape sequence.
    expect(helpers.suggestFilename('https://www.example.com/bad-sequence%E0%A4%A.jpg'))
      .toEqual({ name: '', ext: '' });
  });

});
