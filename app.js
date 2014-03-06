console.log(process.env.DATA_DIR);

var express = require('express')
    , flash = require('connect-flash')
    , bcrypt = require('bcrypt')
    , app = express()
    , http = require('http') // pourrait servir pour faire un proxy
    , passport = require('passport')
    , path = require('path')
    , fs = require('fs')
    , mongoose = require('mongoose')
    , db = mongoose.connect('mongodb://localhost/myapp6')
    , crypto = require('crypto')
    // , User = require('./models').User //.User(db)
    // , Simulation = require('./models').Simulation(db)
    , LocalStrategy = require('passport-local').Strategy;

var versions = fs.readdirSync(process.env.DATA_DIR + '/versions');
console.log(versions);

var UserSchema = new mongoose.Schema({
    username: {type: String, unique: true},
    description: String,
    email: String,
    password: String,
    role: String // admin preparator ops guest
});
// http://devsmash.com/blog/password-authentication-with-mongoose-and-bcrypt
UserSchema.pre('save', function(next) {
  var user = this;
  if(!user.isModified('password')) return next();
  bcrypt.genSalt(10, function(err, salt) {
    if(err) return next(err);
    console.log('pass:' + user.password + ', salt:' + salt);
    bcrypt.hash(user.password, salt, function(err, hash) {
      if(err) return next(err);
      user.password = hash;
      next();
    });
  });
});
UserSchema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if(err) return cb(err);
    cb(null, isMatch);
  });
};
var User = db.model('users', UserSchema);
//mongo ; use myapp6; db.users.remove()
// rm /var/lib/mongodb/mongod.lock ; service mongodb start
//var su = new User({username: 'ops$ope', password: 'ipas0', email: 'e70838@gmail.com', role: 'admin'}); su.save();

// simulations
var SimulationSchema = new mongoose.Schema({
    name        : {type: String, unique: true}
  , description : String
  , readers     : [String]
  , writers     : [String]
});

mongoose.model('simulation', SimulationSchema);
var Simulation = db.model('simulation');

// servers
var ServerSchema = new mongoose.Schema({
    name        : {type: String, unique: true} 
  , hostname    : String 
  , login       : String 
  , dir         : String 
  , datadir     : String 
  , version     : String 
  , mongodb     : String 
  , port        : {type: Number, max:65535, min: 1} 
  , description : String
});

mongoose.model('server', ServerSchema);
var Server = db.model('server');

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use('local', new LocalStrategy(function(username, password, done) {
  console.log('local strategy called with username ' + username + ' and password ' + password);
  User.findOne({ username: username }, function(err, user) {
    if (err) { return done(err); }
    if (!user) { return done(null, false, { message: 'Unknown user ' + username }); }
    user.comparePassword(password, function(err, isMatch) {
      if (err) return done(err);
      console.log('isMatch = ' + isMatch);
      if(isMatch) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Invalid password' });
      }
    });
  });
}));

// Simple route middleware to ensure user is authenticated.  Otherwise send to login page.
var ensureAuthenticated = function ensureAuthenticated(req, res, next) {
  console.log('ensureAuthenticated called');
  if (req.isAuthenticated()) { console.log('true'); return next(); }
  res.redirect('/login')
}

// Check for admin middleware, this is unrelated to passport.js
var ensureAdmin = function ensureAdmin(req, res, next) {
    return function(req, res, next) {
      console.log(req.user);
      if(req.user && req.user.role === 'admin')
        next();
      else
        res.send(403);
    }
}

var md5 = function(str) {
    return crypto.createHash("md5").update(str.toLowerCase().trim()).digest("hex");
}
app.use(express.bodyParser()); // racourci pour json, urlencoded et multipart
app.use(express.cookieParser()); // renseigne req.cookies
app.use(express.cookieSession({secret: 'my secret', cookie: {maxAge: 60 * 60 * 1000}}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
// app.set('port', process.env.PORT || 8080);
app.locals.pretty = true;

app.use(function (req, res, next) {
  console.log ('received: ' + req.method + ' ' + req.url);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  if ('OPTIONS' == res.method) {
    res.send(200);
  } else {
    next();
  }
});
var nonBreaking = function () {
  var reg1 = new RegExp(' ', 'g');
  var reg2 = new RegExp('-', 'g');
  return function (s) {
    return s.replace(reg1, '\u00A0').replace(reg2, '\u2011');
  };
}();
app.use(function (req, res, next) {
    var err = req.flash('error'),
        msg = req.flash('success');
    res.locals.message = '';
    if (err.length) {console.log(err.join('\n')); res.locals.message = '<p class="msg error">' + err.join('<br>') + '</p>';}
    if (msg.length) res.locals.message = '<p class="msg success">' + msg + '</p>';
    if (req.user) {
        console.log('Jef middleware: ' + req.user.username);
        res.locals.username = req.user.username;
        res.locals.description = nonBreaking(req.user.description);
        res.locals.email = nonBreaking(req.user.email);
        res.locals.role  = req.user.role;
        res.locals.gravatar = '//www.gravatar.com/avatar/' + md5(req.user.email) + '.jpg?d=monsterid&';
    }
    next();
});

function userExist(req, res, next) {
    User.count({username: req.body.username}, function (err, count) {
        if (count === 0) {
            next();
        } else {
            req.flash('error', 'User Exist');
            res.redirect('/signup');
        }
    });
}

app.get ('/', ensureAuthenticated, function(req, res) {
    if (req.user.role === 'admin') {
        console.log('Render admin');
        res.render("admin");
    } else {
        res.send("Welcome " + req.user.username + "<br>" + "<a href='/logout'>logout</a>");
    }
});

app.get("/login", function (req, res) { res.render("login"); console.log(res.locals.message)});
app.post("/login", passport.authenticate('local', { successRedirect: '/',
                                                    failureRedirect: '/login',
                                                    failureFlash: true }));
app.get("/lostlogin", function (req, res) {res.render("lostlogin"); });
app.get('/logout', function (req, res) { req.logout(); res.redirect('/'); });

app.get("/password", ensureAuthenticated, function (req, res) { res.render("password");});
app.post("/password", ensureAuthenticated, function (req, res) { // TODO bug
    if (bcrypt.compareSync(req.param('oldpassword'), req.user.password)) {
      if (req.param('password') === req.param('password2')) {
        bcrypt.genSalt(10, function(err, salt) {
          if(err) return next(err);
          bcrypt.hash(req.param('password'), salt, function(err, hash) {
            if(err) return next(err);
            User.findByIdAndUpdate(req.user.id,
              {password: hash}, function(new_user) {req.user = new_user;res.redirect('/');});
          });
        });
      } else {
        console.log(res.locals.message = 'New password and confirm password shall match.');
        res.render("password");
      }
    } else {
        console.log(res.locals.message = 'Authentication failed, please check your password.');
        res.render("password");
    }
});

app.get('/admin/simulations', function (req, res) {
  var query = Simulation.find(null);
  query.exec(function (err, comms) {
    if (err) {throw err;}
    var comm = [];
    for (var i = 0, l = comms.length; i < l; i++) {
        comm.push({id:comms[i].id, name:comms[i].name, description:comms[i].description});
    }
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.json(200, comm);    
  })
});

app.get('/admin/simulations/:id', function (req, res) { // read
  Simulation.findById(req.params.id, function (err, simulation) {
    if (Simulation) {
      console.log ('Get Simulation ' + req.params.id + ' : ' + JSON.stringify(simulation));
      res.json(200, simulation);
    }
  });
});

app.put('/admin/simulations/:id', function (req, res) { // update
  Simulation.findById(req.params.id, function (err, simulation) {
    if (simulation) {
      console.log ('Simulation ' + req.params.id + ' : ' + JSON.stringify(simulation));
      simulation.name = req.body.name;
      simulation.description = req.body.description;
      simulation.save(function (err, newUser) {});
      res.json(200, simulation);
    }
  });
});

app.post('/admin/simulations', function (req, res) { // create
  s = new Simulation({name: req.body.name, description:req.body.description});
  s.save(function (err, newSimulation) {
        if (err) throw err;
        console.log ('Create Simulation ' + newSimulation.name + ' : ' + newSimulation.id + ' : ' + newSimulation.description);
        res.json(200, {id: newSimulation.id, name: newSimulation.name, description: newSimulation.description});
    });
});
app.delete('/admin/simulations/:id', function (req, res) { // delete
    Simulation.findByIdAndRemove(req.params.id, function (err, simulation) {
        return res.send(204, '');
    });
});

// users
app.get('/admin/users', function (req, res) {
  var query = User.find(null);
  query.exec(function (err, comms) {
    if (err) {throw err;}
    var comm = [];
    for (var i = 0, l = comms.length; i < l; i++) {
        comm.push({id:comms[i].id, username:comms[i].username,
          description:comms[i].description, role:comms[i].role, email:comms[i].email});
    }
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.json(200, comm);    
  })
});

app.get('/admin/users/:id', function (req, res) { // read
  User.findById(req.params.id, function (err, user) {
    if (user) {
      console.log ('User ' + req.params.id + ' : ' + JSON.stringify(user));
      res.json(200, user);
    }
  });
});

app.put('/admin/users/:id', function (req, res) { // update
  User.findById(req.params.id, function (err, el) {
    if (el) {
      console.log ('User ' + req.params.id + ' : ' + JSON.stringify(el));
      el.username = req.body.username;
      el.description = req.body.description;
      el.email = req.body.email;
      el.password = req.body.password;
      el.role = req.body.role;
      el.save(function (err, newUser) {});
      res.json(200, el);
    }
  });
});

app.post('/admin/users', function (req, res) { // create
  s = new User({username: req.body.username, description:req.body.description,
    password: req.body.password, role: req.body.role, email: req.body.email});
  s.save(function (err, el) {
        if (err) throw err;
        console.log ('User ' + el.username + ' : ' + el.id + ' : ' + el.description + ' : ' + el.password + ' : ' + el.role + ' : ' + el.email);
        res.json(200, {id: el.id, username: el.username, description: el.description,
          password: el.password, role: el.role});
    });
});
app.delete('/admin/users/:id', function (req, res) { // delete
    User.findByIdAndRemove(req.params.id, function (err, server) {
        return res.send(204, '');
    });
});
// end users

app.get('/admin/versions', function (req, res) {
  console.log ('Versions: ' + JSON.stringify(versions));
  res.json(200, versions);
});

app.get('/admin/ping', function (req, res) {
  console.log ('ping : ' + JSON.stringify(req.query));
  var exec = require('child_process').exec;
  exec('ping -c 1 ' + req.query.hostname, function (error, stdout, stderr) {
    res.json(200, [stdout, stderr]);
  });
});

app.get('/admin/login/:h/:l', function (req, res) {
  console.log ('login: ' + req.params.l + '@' + req.params.h);
  var exec = require('child_process').exec;
  exec('ssh ' + req.params.l + '@' + req.params.h + ' uname -r', function (error, stdout, stderr) {
    res.json(200, [stdout, stderr]);
  });
});

app.get('/admin/port/:h/:l/:p', function (req, res) {
  console.log ('port: ' + req.params.l + '@' + req.params.h + ' ' + req.params.p);
  var exec = require('child_process').exec;
  exec('ssh ' + req.params.l + '@' + req.params.h + ' fuser ' + req.params.p + '/tcp', function (error, stdout, stderr) {
    res.json(200, [stdout, stderr]);
  });
});

// servers
app.get('/admin/servers', function (req, res) {
  var query = Server.find(null);
  query.exec(function (err, comms) {
    if (err) {throw err;}
    var comm = [];
    for (var i = 0, l = comms.length; i < l; i++) {
        comm.push({
            id          : comms[i].id
          , name        : comms[i].name
          , hostname    : comms[i].hostname
          , login       : comms[i].login
          , dir         : comms[i].dir
          , datadir     : comms[i].datadir
          , version     : comms[i].version
          , mongodb     : comms[i].mongodb
          , port        : comms[i].port
          , description : comms[i].description
        });
    }
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.json(200, comm);
  })
});

app.get('/admin/servers/:id', function (req, res) { // read
  Server.findById(req.params.id, function (err, server) {
    if (server) {
      console.log ('Server ' + req.params.id + ' : ' + JSON.stringify(server));
      res.json(200, server);
    }
  });
});

app.put('/admin/servers/:id', function (req, res) { // update
  Server.findById(req.params.id, function (err, server) {
    if (server) {
      console.log ('Server ' + req.params.id + ' : ' + JSON.stringify(server));
      server.name        = req.body.name;
      server.hostname    = req.body.hostname;
      server.login       = req.body.login;
      server.dir         = req.body.dir;
      server.datadir     = req.body.datadir;
      server.version     = req.body.version;
      server.mongodb     = req.body.mongodb;
      server.port        = req.body.port;
      server.description = req.body.description;
      server.save(function (err, newUser) {
        res.json(200, server);
      });
    }
  });
});

app.post('/admin/servers', function (req, res) { // create
  s = new Server({name: req.body.name, hostname: req.body.hostname
    , login:req.body.login, dir: req.body.dir, datadir: req.body.datadir, version: req.body.version
    , mongodb: req.body.mongodb, port: req.body.port, description:req.body.description});
  s.save(function (err, newServer) {
        if (err) throw err;
        console.log ('Server ' + JSON.stringify(newServer));
        res.json(200, newServer);
    });
});
app.delete('/admin/servers/:id', function (req, res) { // delete
    Server.findByIdAndRemove(req.params.id, function (err, server) {
        return res.send(204, '');
    });
});
// end servers

var port_number=process.env.VMC_APP_PORT || 6969;
http.createServer(app).listen(port_number);
console.log('listening on http://127.0.0.1:' + port_number + ' ' + (process.env.LOGIN || 'noname'))
console.log('lsof -i :6969');
console.log('fuser 6969/tcp');