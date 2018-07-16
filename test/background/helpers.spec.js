'use strict';

describe("background/helper.js", function() {

  var helpers;

  beforeEach(function () {
    helpers = modules.helpers;
  });

  it("should suggest filenames for normal URLs", function() {
    // Return null so the browser can guess the filename.
    expect(helpers.suggestFilename('https://www.example.com/'))
      .toBe(null);

    // Simple URLs with normal features.
    expect(helpers.suggestFilename('https://www.example.com/example.html'))
      .toBe('example.html');
    expect(helpers.suggestFilename('https://www.example.com/example.html?q=search'))
      .toBe('example.html');
    expect(helpers.suggestFilename('https://www.example.com/example.html?q=search#anchor'))
      .toBe('example.html');
    expect(helpers.suggestFilename('https://www.example.com/example.html#anchor'))
      .toBe('example.html');
    expect(helpers.suggestFilename('https://www.example.com/example.jpg'))
      .toBe('example.jpg');
    expect(helpers.suggestFilename('https://www.example.com/subdir/example.jpg'))
      .toBe('example.jpg');
    expect(helpers.suggestFilename('https://www.example.com/subdir/example'))
      .toBe('example');
    expect(helpers.suggestFilename('https://www.example.com/subdir/video.mp4'))
      .toBe('video.mp4');

    // Simple URLs with characters that are not valid for paths.
    expect(helpers.suggestFilename('https://www.example.com/bad:file.txt'))
      .toBe('bad file.txt');
    expect(helpers.suggestFilename('https://www.example.com/bad%3Ffile.txt'))
      .toBe('bad file.txt');

    // Examples from #251 - trailing text after extension.
    expect(helpers.suggestFilename('https://pbs.twimg.com/media/Deh3bIAXUAAfyxP.jpg:large'))
      .toBe('Deh3bIAXUAAfyxP.jpg');

    // Examples from #261 - repeated dots in filename.
    expect(helpers.suggestFilename('https://www.example.com/string01.string02_string03.jpg'))
      .toBe('string01.string02_string03.jpg');
    expect(helpers.suggestFilename('https://www.example.com/string01.string02/string03.string04_string05.jpg'))
      .toBe('string03.string04_string05.jpg');

    // Video with no extension but mime-type is known.
    expect(helpers.suggestFilename('https://www.example.com/sample_video', 'video/webm'))
      .toBe('sample_video.webm');
  });

  it("should suggest filenames for data: URLs", function() {
    // No mime-type should default to text.
    expect(helpers.suggestFilename('data:,Hello%2C%20World!')).toBe('data.txt');

    // Known mime-types should get valid extensions.
    expect(helpers.suggestFilename('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D')).toBe('data.txt');
    expect(helpers.suggestFilename('data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E')).toBe('data.html');
    expect(helpers.suggestFilename('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBe('data.gif');
    expect(helpers.suggestFilename('data:application/octet-stream;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBe('data.bin');

    // Unknown mime type defaults to .bin
    expect(helpers.suggestFilename('data:unknown/mime;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBe('data.bin');
  });

  it("should suggest filenames and handle invalid URLs", function() {
    // URL contains an invalid escape sequence.
    expect(helpers.suggestFilename('https://www.example.com/bad-sequence%E0%A4%A.jpg'))
      .toBe(null);
  });

});
