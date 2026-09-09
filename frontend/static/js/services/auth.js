// Token handling for the API. simplejwt returns an access/refresh pair from
// /api/auth/; the access token goes out on every request as a Bearer header.
angular.module('pizza')
.constant('TOKEN_KEY', 'pizzaAccessToken')
.constant('REFRESH_KEY', 'pizzaRefreshToken')
.constant('USERNAME_KEY', 'pizzaUsername')

.factory('auth', function ($http, $window, $rootScope, TOKEN_KEY, REFRESH_KEY, USERNAME_KEY) {
  var store = $window.sessionStorage;

  return {
    token: function () {
      return store.getItem(TOKEN_KEY);
    },
    username: function () {
      return store.getItem(USERNAME_KEY) || '';
    },
    isAuthenticated: function () {
      return !!store.getItem(TOKEN_KEY);
    },
    login: function (username, password) {
      return $http.post($rootScope.APIURL + '/api/auth/', {
        username: username,
        password: password
      }).then(function (response) {
        store.setItem(TOKEN_KEY, response.data.access);
        store.setItem(REFRESH_KEY, response.data.refresh);
        store.setItem(USERNAME_KEY, username);
        return response.data;
      }, function (error) {
        store.removeItem(TOKEN_KEY);
        store.removeItem(REFRESH_KEY);
        store.removeItem(USERNAME_KEY);
        throw error;
      });
    },
    logout: function () {
      store.removeItem(TOKEN_KEY);
      store.removeItem(REFRESH_KEY);
      store.removeItem(USERNAME_KEY);
    }
  };
})

.factory('authInterceptor', function ($q, $window, TOKEN_KEY) {
  return {
    request: function (config) {
      var token = $window.sessionStorage.getItem(TOKEN_KEY);
      config.headers = config.headers || {};
      if (token) {
        config.headers.Authorization = 'Bearer ' + token;
      }
      return config;
    },
    responseError: function (rejection) {
      if (rejection.status === 401) {
        $window.sessionStorage.removeItem(TOKEN_KEY);
      }
      return $q.reject(rejection);
    }
  };
})

.config(function ($httpProvider) {
  $httpProvider.interceptors.push('authInterceptor');
});
