Ember.Socket = Ember.Object.extend({
	controllers: [],

	socket: null,

	init: function() {
		this.set('user', Ember.A());
		this.set('networks', Ember.A());
		this.set('tabs', Ember.A());
		this.set('channelUsers', Ember.A());
		this.set('events', Ember.A());
		// setup the collections
	},

	connect: function() {
		var self = this;

		return new Ember.RSVP.Promise(function(resolve, reject) {
			var socket = io.connect();
			// connect

			socket.on('error', function(err) {
				reject(err);
			});

			socket.on('connect', function() {
				self._listen();

				resolve();
			});
			// bind events

			self.set('socket', socket);
		});
	},

	_listen: function() {
		var self = this;

		this.socket.on('users', function(data) {
			self._handle('users', data);
		});

		this.socket.on('networks', function(data) {
			self._handle('networks', data);
		});

		this.socket.on('tabs', function(data) {
			self._handle('tabs', data);
		});

		this.socket.on('insert', function(data) {
			console.log(data);
		});

		this.socket.on('update', function(data) {
			console.log(data);
		});

		this.socket.on('remove', function(data) {
			console.log(data);
		});
		// handle our events individually
		// for sake of ease - like meteor, however we can get collection records in bulk
		// there is an event for each collection apart from channelUsers, along with 3 additional events
		// that indicate whether to insert/update/remove a record from one of the collections

		setTimeout(function() {
			
			self.request('events').then(function(data) {
				console.log(self.findAll('events'));
			});

		}, 100);
	},

	_handle: function(collection, data) {
		var self = this;
		if (collection === 'tabs') {
			data.forEach(function(payload) {
				if (payload.users.length > 0) {
					self._store('channelUsers', payload.users);
				}

				delete payload.users;
				// remove it so it's not stored in the tab map

				self._store('tabs', [payload]);
			});
		} else {
			self._store('networks', data);
		}
	},

	_store: function(collection, payload) {
		for (var i in payload) {
			if (!payload.hasOwnProperty(i)) {
				continue;
			}

			var item = payload[i];
			if (item._id) {
				this.get(collection).pushObject(item);
			}
		}
	},

	_search: function(query, obj) {
		for (var key in query) {
			if ((key in obj && query[key] == obj[key]) === false) {
				return false;
			}
		}
		return true;
	},

	_find: function(many, type, query) {
		var self = this,
			collection = this.get(type);
		
		if (!collection) {
			return false;
		}

		if (many) {
			var set = collection.filter(function(obj) {
				return self._search(query, obj);
			});
		} else {
			var set = collection.find(function(obj) {
				return self._search(query, obj);
			});
		}
		// attempt to find

		if (set) {
			return set;
		} else {
			return false;
		}
	},

	_send: function(event, payload, callback) {
		if (callback) {
			this.socket.emit(event, payload, callback);
		} else {
			this.socket.emit(event, payload);
		}
	},

	findOne: function(type, query) {
		return this._find(false, type, query);
	},

	find: function(type, query) {
		return this._find(true, type, query);
	},

	findAll: function(type) {
		var collection = this.get(type);
		
		if (!collection) {
			return false;
		}

		return collection;
	},

	request: function(type, query) {
		var self = this;

		return new Ember.RSVP.Promise(function(resolve, reject) {
			self._send(type, query, function(response) {
				if (response.length > 0) {
					resolve(response);
					self._store(type, response);
				} else {
					reject('not found');
				}
			});
		});
		// this is used to request way back records
		// think messages that are a day old, we probably didn't get them in
		// the sync event so they won't be in our data store, so we make a query
		// which will request them, and return a promise.
	},

	update: function(type, query, update) {
		var self = this,
			payload = {collection: type, query: query, update: update};

		return new Ember.RSVP.Promise(function(resolve, reject) {
			self._send('update', payload, function(response) {
				if (response.length > 0) {
					self._handle(type, response);
					// handle so we can insert into db

					resolve(response);
					// also send it back if someone wants to do a straight away
					// handle on the response
				} else {
					reject('not updated');
				}
			});
		});
	}
});

Ember.onLoad('Ember.Application', function($app) {
	$app.initializer({
		name: 'sockets',

		initialize: function(container, application) {
			application.register('socket:main', application.Socket, {
				singleton: true
			});
			// register `socket:main` with Ember.js.

			application.inject('controller', 'socket', 'socket:main');
			// we then want to inject `socket` into each controller.
		}
	});
});