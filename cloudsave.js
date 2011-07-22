var Hosts = {};

var original = {
  'image': {
    picasa: 'Picasa',
    twitpic: 'TwitPic',
    flickr: 'Flickr',
    posterous: 'Posterous',
    twitrpix: 'Twitrpix',
    twitgoo: 'Twitgoo',
    facebook: 'Facebook',
    imgly: 'Imgly'
  },
  'all': {
    box: 'Box.net',
    sugarsync: 'SugarSync',
    dropbox: 'Dropbox',
    gdocs: 'Google Docs',
    minus: 'Min.us',
    cloudapp: 'CloudApp',
    clouddrive: 'Amazon Cloud',
    droplr: 'Droplr',
    skydrive: 'SkyDrive',
    webdav: 'WebDAV'
  }, 
  'link': {
    dropdo: 'Dropdo' //this one is peculiar because it works differently from all the other hosts
  }
};
var additional = {
  'image': {
    imageshack: 'Imageshack',
    imgur: 'Imgur',
    immio: 'Imm.io'
  },
  'all': {
    hotfile: 'Hotfile'
  }
};

try {
  recent = JSON.parse(localStorage.cloudsave_recent);
} catch (err) {
  recent = [
    'hotfile',
    'gdocs',
    'dropbox'
  ];
}

String.prototype.endsWith = function (s) {
  return this.length >= s.length && this.substr(this.length - s.length) === s;
};

function handle_click(tab) {
  var url = tab.url;
  if (url.endsWith('.pdf+html')) {
    url = tab.url.substr(0, tab.url.length - 5);
  }
  console.log('Source URL', url);
  var name = unescape(decodeURIComponent(
                      unescape(unescape(unescape(url)))
                               .replace(/\s/g, '+')
                     .replace(/^.*\/|\?.*$|\#.*$|\&.*$/g,'') || 
                  url.replace(/.*\/\/|www./g,'')
                     .replace(/[^\w]+/g,'_')
                     .replace(/^_*|_*$/g,''))
             ).replace(/\+/g, ' ');
  console.log('Processed name', name);

  var host = localStorage.cloudsave_service || 'dropbox';
  if (Hosts[host]) {

    if (host === 'dropbox' && localStorage.folder_prefix) {
      name = localStorage.folder_prefix + name;
    }

    if (name.indexOf('/') !== -1) {
      localStorage.folder_prefix = name.replace(/[^\/]+$/, '');
    }
    
    upload(host, url, name);
    console.log(host, url, name);

    recent.push(host);
    //recent.shift();
    localStorage.cloudsave_recent = JSON.stringify(recent);

  } else {
    alert('Could not find host ' + host);
  }
}


function open_settings() {
  chrome.tabs.create({url: 'settings.html'});
}

//shamelessly stolen from john resig.
function wbr(str, num) {  
  return str.replace(RegExp('(\\w{' + num + '})(\\w)', 'g'), function(all,text,char){ 
    return text + '<wbr>' + char; 
  }); 
}

var INDETERMINATE = {};

function updateNotification(id, arg1, arg2) {
  function main() {
    var wins = chrome.extension.getViews({type: 'notification'});
    var matches = wins.filter(function (win) {
      return win.location.search.substr(1) === id;
    });
    if (id === 42) matches = wins; //please coding gods dont kill me
    if (matches.length) {
      if (typeof arg1 === 'number' || arg1 === INDETERMINATE) {
        matches[0].document.getElementById('progress').style.display = '';
        matches[0].document.getElementById('progress').value = arg1 === INDETERMINATE ? null : arg1;
      } else if (arg2) {
        matches[0].document.getElementById('status').innerHTML = arg2;
        matches[0].document.body.style.backgroundImage = 'url(' + arg1 + ')';
        matches[0].document.getElementById('progress').style.display = 'none';
      } else {
        matches[0].document.getElementById('status').innerHTML = arg1;
      }
    } else {
      return false;
    }
    return true;
  }
  if (!main()) {
    console.log('Error! Could not locate notification', id, arg1, arg2);
    var count = 0;
    function looper() {
      if (!main() && count++ < 100) setTimeout(looper, 10);
    }
    looper();
  }
}


var urlid = {
  'todo_fix_this': 42
  //this is a sort of hack. it uses the file download urls
  //as a sort of state callback whatnot stuff.
};

function uploadProgress(url, event) {
  updateNotification(urlid[url], event.loaded/event.total/2 + 0.5);
}

function downloadProgress(url, event) {
  updateNotification(urlid[url], event.loaded/event.total/2);
}


function upload(host, url, name) {
  var id = Math.random().toString(36).substr(3);

  var notification = webkitNotifications.createHTMLNotification('popup.html?' + id);

  notification.ondisplay = function () {
    updateNotification(id, 'icon/throbber.gif', 
      'The file "' + wbr(name, 8) + '" is being saved to "' + host + '" ...');
    updateNotification(id, INDETERMINATE);
  };
  var has_uploaded = false;
  var upload_callback = function () {};

  notification.onclick = function () {
    if (has_uploaded) {
      openFile();
    } else {
      updateNotification(id, 'Opening file "' + wbr(name, 8) + '" on "' + host + '" in a few seconds...');
      upload_callback = openFile;
    }
  };
  notification.onclose = function () {
    delete urlid[url];
  };

  function openFile() {
    chrome.tabs.create({url: has_uploaded});
  }

  notification.show();
  urlid[url] = id;

  Hosts[host]({
    url: url,
    name: name
  }, function (e) {
    has_uploaded = e && e.url;
    setTimeout(upload_callback, 200);
    console.log('uploaded file yay', e);
    if (e && typeof e === "string" && e.indexOf('error:') !== -1) {
      updateNotification(id, 'icon/64sad.png', 
        'The file "' + wbr(name, 8) + '" could not be uploaded to "' +
        host + '". ' + e.substr(6));
    } else {
      updateNotification(id, 'icon/64.png', 
        'The file "' + wbr(name, 8) + '" has been uploaded to "' + host + '".'
        );
      setTimeout(function () {
        notification.cancel();
      }, 5.4 * 1000); //May the fourth be with you.
    }
  });
}
