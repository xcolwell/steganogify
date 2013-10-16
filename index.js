/* appended to local file names created by the tool, as
    prefixSUFFIX.gif */
var SUFFIX = ".steganogify.com";

var name = null;
var gifBytes = null;
var changed = false;

var currentNotif = null;


function load() {
  if (window.requestFileSystem) {

    // drag and drop
    document.body.addEventListener('dragover', function(e) {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }, false);
    document.body.addEventListener('drop', function(e) {
      e.stopPropagation();
      e.preventDefault();

      var files = e.dataTransfer.files;

      for (var i = 0, f; f = files[i]; i++) {
        if (/\.gif$/.test(f.name) && readGif(f)) {
          break;
        }
      }
    }, false);

    // editing
    document.getElementById('the_message').addEventListener('blur', function(e) {

      if (null !== gifBytes && changed) {
        gifBytes = encode(gifBytes, sanitizeTextareaValue(document.getElementById('the_message').value));

        writeLocalGif();

        showNotif('the_golden_update_notif');
        changed = false;
      }
    }, false);
    document.getElementById('the_message').addEventListener('input', function(e) {
      if (null !== gifBytes) {
        showNotif('the_update_notif');
        changed = true;
      }
    }, false);

  } else {
    // :( filesystem API not supported :(
    document.getElementById('the_img').src = 'not_supported.gif';
  }
}


// window.addEventListener('load', load);


// NOTIFS

function showNotif(id) {
  if (null !== currentNotif) {
    currentNotif.className = '';
    currentNotif = null;
  }
  if (null != id) {
    currentNotif = document.getElementById(id);
    currentNotif.className = 'show';
  }
}


// GIF READING + WRITING

function readGif(f) {
  var reader = new FileReader();
  reader.onload = (function(theFile) {
    return function(e) {
      name = theFile.name.replace(/\.gif$/, SUFFIX + '.gif')
      gifBytes = new Uint8Array(e.target.result);

      writeLocalGif();

      var message = decode(gifBytes);
      if (null == message) {
        showNotif('the_empty_notif');
        document.getElementById('the_message').value = '';
      } else {
        showNotif(null);
        document.getElementById('the_message').value = message;
      }

      document.getElementById('the_message').disabled = false;
      changed = false;
    };
  })(f);

  reader.readAsArrayBuffer(f);

  return true;
}

function writeLocalGif() {
  window.requestFileSystem(window.TEMPORARY, 8 * 1024 * 1024, function(fs) {
    (function(blob) {
      fs.root.getFile(name, {
        create: true
      }, function(fileEntry) {
        fileEntry.createWriter(function(fileWriter) {
          fileWriter.onwriteend = function(e) {

            document.getElementById('the_img').src = fileEntry.toURL();
            document.getElementById('the_link').href = fileEntry.toURL();
            document.getElementById('the_golden_link').href = fileEntry.toURL();

          };
          fileWriter.write(blob); // Note: write() can take a File or Blob object.

        }, errorHandler);
      }, errorHandler);
    })(new Blob([gifBytes], {
      type: 'image/gif'
    }));

  }, errorHandler);
}


// FS 

window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

function errorHandler(e) {
  var msg = '';

  switch (e.code) {
    case FileError.QUOTA_EXCEEDED_ERR:
      msg = 'QUOTA_EXCEEDED_ERR';
      break;
    case FileError.NOT_FOUND_ERR:
      msg = 'NOT_FOUND_ERR';
      break;
    case FileError.SECURITY_ERR:
      msg = 'SECURITY_ERR';
      break;
    case FileError.INVALID_MODIFICATION_ERR:
      msg = 'INVALID_MODIFICATION_ERR';
      break;
    case FileError.INVALID_STATE_ERR:
      msg = 'INVALID_STATE_ERR';
      break;
    default:
      msg = 'Unknown Error';
      break;
  };

  console.log('Error: ' + msg);
}


// UTIL

/* the textarea pads the .value with a bunch of 
 * null chars for some reason */
function sanitizeTextareaValue(value) {
  var svalue = "";
  for (var i = 0, n = value.length; i < n; ++i) {
    if (0 !== value.charCodeAt(i))
      svalue += value.charAt(i);
  }
  return svalue;
}