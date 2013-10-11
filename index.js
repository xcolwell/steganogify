

var SUFFIX = ".steganogify.com";

var name = null;
var gifBytes = null;
var changed = false;

var currentNotif = null;



window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;

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



// Uint8Array
function writeLocalFile() {
	window.requestFileSystem(window.TEMPORARY, 64 *1024*1024, function(fs) {
    // Duplicate each file the user selected to the app's fs.


      // Capture current iteration's file in local scope for the getFile() callback.
      (function(blob) {
        fs.root.getFile(name, {create: true}, function(fileEntry) {
          fileEntry.createWriter(function(fileWriter) {
          	fileWriter.onwriteend = function(e) {

	            document.getElementById('the_img').src = fileEntry.toURL();
	            document.getElementById('the_link').href = fileEntry.toURL();
	            document.getElementById('the_golden_link').href = fileEntry.toURL();

          	};
            fileWriter.write(blob); // Note: write() can take a File or Blob object.

          }, errorHandler);
        }, errorHandler);
      })(new Blob([gifBytes], {type: 'image/gif'}));

  }, errorHandler);
}





function initWithFile(f) {



var reader = new FileReader();

      // Closure to capture the file information.
      reader.onload = (function(theFile) {
        return function(e) {
          // e.target.result has the byte array

          name = theFile.name.replace(/\.gif$/, SUFFIX + '.gif')

          gifBytes = new Uint8Array(e.target.result);

          writeLocalFile();





		// init the message state
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

  function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files; // FileList object.

    // files is a FileList of File objects. List some properties.
    for (var i = 0, f; f = files[i]; i++) {
      if (/\.gif$/.test(f.name) && initWithFile(f)) {
      	break;
      }
    }
  }

  function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
  }

  
function sanitizeTextareaValue(value) {
	var svalue = "";
	for (var i = 0, n = value.length; i < n; ++i) {
		if (0 !== value.charCodeAt(i))
			svalue += value.charAt(i);
	}
	return svalue;
}



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

 
 function load() {
  if (window.requestFileSystem) {
  // Setup the dnd listeners.
  document.body.addEventListener('dragover', handleDragOver, false);
  document.body.addEventListener('drop', handleFileSelect, false);

  document.getElementById('the_message').addEventListener('blur', function(e) {

  			if (null !== gifBytes && changed) {

  	gifBytes = encode(gifBytes, sanitizeTextareaValue(document.getElementById('the_message').value));

      	    writeLocalFile();

	            showNotif('the_golden_update_notif');

	            changed = false;
      }
  });
  document.getElementById('the_message').addEventListener('input', function(e) {
  		if (null !== gifBytes) {
  			showNotif('the_update_notif');
  			changed = true;
  		}
  });
} else {
	document.getElementById('the_img').src = 'not_supported.gif';
}
}


window.addEventListener('load', load);

