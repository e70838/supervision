    function htmlEncode(value){
      return $('<div/>').text(value).html();
    }
    $.fn.serializeObject = function() {
      var o = {};
      var a = this.serializeArray();
      $.each(a, function() {
          if (o[this.name] !== undefined) {
              if (!o[this.name].push) {
                  o[this.name] = [o[this.name]];
              }
              o[this.name].push(this.value || '');
          } else {
              o[this.name] = this.value || '';
          }
      });
      return o;
    };

    $.ajaxPrefilter( function( options, originalOptions, jqXHR ) {
      options.url = 'http://127.0.0.1:6969' + options.url;
    });

    // Simulations
    var Sites = Backbone.Collection.extend({
      url: '/admin/simulations'
    });

    var Site = Backbone.Model.extend({
      urlRoot: '/admin/simulations'
    });

    var siteListView = Backbone.View.extend({
      el: '.page',
      render: function () {
        var that = this;
        var sites = new Sites();
        sites.fetch({
          success: function (l) {
            var template = _.template($('#site-list-template').html(), {l: l.models});
            that.$el.html(template);
          }
        })
      }
    });

    var siteListView = new siteListView();

    var siteEditView = Backbone.View.extend({
      el: '.page',
      events: {
        'submit .edit-site-form': 'saveSite',
        'click .edit-site-form .delete': 'deleteSite'
      },
      saveSite: function (ev) {
        var siteDetails = $(ev.currentTarget).serializeObject();
        var site = new Site();
        site.save(siteDetails, {
          success: function (site) {
            router.navigate('/simulations', {trigger:true});
          }
        });
        return false;
      },
      deleteSite: function (ev) {
        console.log('deleteSite is called');
        this.site.destroy({
          success: function () {
            console.log('destroyed');
            router.navigate('simulations', {trigger:true});
          }
        });
        return false;
      },
      render: function (options) {
        var that = this;
        if(options.id) {
          that.site = new Site({id: options.id});
          that.site.fetch({
            success: function (el) {    
              var template = _.template($('#edit-site-template').html(), {el: el});
              that.$el.html(template);
            }
          })
        } else {
          var template = _.template($('#edit-site-template').html(), {el: null});
          that.$el.html(template);
        }
      }
    });

    var siteEditView = new siteEditView();

    // Users
    var Users = Backbone.Collection.extend({
      url: '/admin/users'
    });

    var User = Backbone.Model.extend({
      urlRoot: '/admin/users',
      validate: function(attribs, options) {
        console.log('validate called');
        if (attribs.username === '')
          return "Invalid username"; // set model.validationError
      }
    });

    var userListView = Backbone.View.extend({
      el: '.page',
      render: function () {
        var that = this;
        var users = new Users();
        users.fetch({
          success: function (l) {
            var template = _.template($('#user-list-template').html(), {l: l.models});
            that.$el.html(template);
          }
        })
      }
    });

    var userListView = new userListView();

    var userEditView = Backbone.View.extend({
      el: '.page',
      events: {
        'submit .edit-user-form': 'saveUser',
        'click .edit-user-form .delete': 'deleteUser'
      },
      saveUser: function (ev) {
        var details = $(ev.currentTarget).serializeObject();
        var user = new User();
        user.save(details, {
          success: function (el) {
            router.navigate('users', {trigger:true});
          },
          error: function(model, response, options) {
            console.log(model.validationError + ' ' + response);
          }
        });
        return false;
      },
      deleteUser: function (ev) {
        this.user.destroy({
          success: function () {
            console.log('destroyed');
            router.navigate('users', {trigger:true});
          }
        });
        return false;
      },
      render: function (options) {
        var that = this;
        if(options.id) {
          that.user = new User({id: options.id});
          that.user.fetch({
            success: function (el) {    
              var template = _.template($('#edit-user-template').html(), {el: el});
              that.$el.html(template);
              $('#f2role option[value="' + el.get('role') + '"]').prop('selected', true);
            }
          })
        } else {
          var template = _.template($('#edit-user-template').html(), {el: null});
          that.$el.html(template);
        }
      }
    });

    var userEditView = new userEditView();
    // end of users view

    // Servers
    var Servers = Backbone.Collection.extend({
      url: '/admin/servers'
    });
    var Server = Backbone.Model.extend({
      urlRoot: '/admin/servers'
    });

    var serverListView = Backbone.View.extend({
      el: '.page',
      render: function () {
        var that = this;
        var servers = new Servers();
        servers.fetch({
          success: function (l) {
            var template = _.template($('#server-list-template').html(), {l: l.models});
            that.$el.html(template);
          }
        })
      }
    });

    var serverListView = new serverListView();

    var serverEditView = Backbone.View.extend({
      el: '.page',
      events: {
        'submit .edit-server-form': 'saveServer',
        'click .edit-server-form .delete': 'deleteServer',
        'click #f3ckhostname': 'pingServer',
        'click #f3cklogin': 'testLogin',
        'click #f3ckport': 'testPort'
      },
      pingServer: function (ev) {
        var details = $(ev.currentTarget.parentNode.parentNode).serializeObject();
        $.get('/admin/ping', {hostname: details.hostname}, function (v) {
          var d = document.createElement('div');
          d.setAttribute('class', 'col-sm-12 alert alert-dismissable ' + (v[1].length ? 'alert-danger' : 'alert-success'));
          d.innerHTML = '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>'
            + (v[1].length ? v[1] : v[0]);
          ev.currentTarget.parentNode.appendChild(d);
        });
        return false;
      },
      testLogin: function (ev) {
        var details = $(ev.currentTarget.parentNode.parentNode).serializeObject();
        $.get('/admin/login/' + details.hostname + '/' + details.login, {}, function (v) {
          var d = document.createElement('div');
          d.setAttribute('class', 'col-sm-12 alert alert-dismissable ' + (v[1].length ? 'alert-danger' : 'alert-success'));
          d.innerHTML = '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>'
            + (v[1].length ? v[1] : v[0]);
          ev.currentTarget.parentNode.appendChild(d);
        });
        return false;
      },
      testPort: function (ev) {
        var details = $(ev.currentTarget.parentNode.parentNode).serializeObject();
        $.get('/admin/port/' + details.hostname + '/' + details.login + '/' + details.port, {}, function (v) {
          var d = document.createElement('div');
          d.setAttribute('class', 'col-sm-12 alert alert-dismissable ' + (v[1].length ? 'alert-danger' : 'alert-success'));
          d.innerHTML = '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>'
            + (v[1].length ? v[1] : v[0]);
          ev.currentTarget.parentNode.appendChild(d);
        });
        return false;
      },
      saveServer: function (ev) {
        var details = $(ev.currentTarget).serializeObject();
        var server = new Server();
        server.save(details, {
          success: function (el) { // element
            router.navigate('servers', {trigger:true});
          }
        });
        return false;
      },
      deleteServer: function (ev) {
        this.server.destroy({
          success: function () {
            console.log('destroyed');
            router.navigate('servers', {trigger:true});
          }
        });
        return false;
      },
      render: function (options) {
        var that = this;
        if(options.id) {
          that.server = new Server({id: options.id});
          that.server.fetch({
            success: function (el) {
              $.get('/admin/versions', {}, function (v) {
                  var template = _.template($('#edit-server-template').html(), {el: el, v: v});
                  console.log('server: ' + JSON.stringify(el))
                  console.log('versions2: ' + JSON.stringify(v))
                  that.$el.html(template);
                }
              );
            }
          })
        } else {
          $.get('/admin/versions', {}, function (v) {
            var template = _.template($('#edit-server-template').html(), {el: null, v: v});
            that.$el.html(template);
          });
        }
      }
    });

    var serverEditView = new serverEditView();
    // end of servers view

    var Router = Backbone.Router.extend({
        routes: {
          "": "home", 
          "simulations": "simulations",
          "edit/:id": "simulations_edit",
          "new": "simulations_edit",
          "users": "users",
          "users/edit/:id": "users_edit",
          "users/new": "users_edit",
          "servers": "servers",
          "servers/edit/:id": "servers_edit",
          "servers/new": "servers_edit",
        }
    });

    var router = new Router;
    router.on('route:home', function() {
      router.navigate('simulations', {trigger: true, replace: true});
    })
    router.on('route:simulations', function() {
      siteListView.render();
    })
    router.on('route:simulations_edit', function(id) {
      siteEditView.render({id: id});
    })
    router.on('route:users', function() {
      userListView.render();
    })
    router.on('route:users_edit', function(id) {
      userEditView.render({id: id});
    })
    router.on('route:servers', function() {
      serverListView.render();
    })
    router.on('route:servers_edit', function(id) {
      serverEditView.render({id: id});
    })
    Backbone.history.start();

    $(document).ready(function () {
        $('ul.jef > li').click(function (e) {
            $('ul.jef > li').removeClass('active');
            $(this).addClass('active');                
        });            
    });