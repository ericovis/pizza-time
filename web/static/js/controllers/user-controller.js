var app = angular.module('pizza');

function url_base64_decode(str) {
  var output = str.replace('-', '+').replace('_', '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw 'Illegal base64url string!';
  }
  return window.atob(output); //polifyll https://github.com/davidchambers/Base64.js
}

app.controller('UserCtrl', function ($scope, $http, $window, $rootScope) {

  $scope.user = {username: 'jklimber', password: 'start123'};
  $scope.isAuthenticated = (typeof $window.sessionStorage.profile !== "undefined");

  $scope.login = function () {
    $http
      .post($rootScope.APIURL + '/auth/', $scope.user)
      .success(function (data, status, headers, config) {
        $window.sessionStorage.token = data.token;
        $scope.isAuthenticated = true;
        var encodedProfile = data.token.split('.')[1];
        $window.sessionStorage.profile = JSON.parse(url_base64_decode(encodedProfile));
        $scope.welcome = '';
        $scope.message = '';

      })
      .error(function (data, status, headers, config) {
        // Erase the token if the user fails to log in
        delete $window.sessionStorage.token;
        // Handle login errors here
        $scope.error = 'Error: Invalid user or password';
        alert($scope.error);
      });
  };

  $scope.logout = function () {
    $scope.isAuthenticated = false;
    delete $scope.welcome;
    delete $scope.message;
    delete $window.sessionStorage.token;
    delete $window.sessionStorage.profile;
  };

})
.factory('authInterceptor', function ($rootScope, $q, $window) {
  return {
    request: function (config) {
      config.headers = config.headers || {};
      if ($window.sessionStorage.token) {
        config.headers.Authorization = 'JWT ' + $window.sessionStorage.token;
      }
      return config;
    },
    responseError: function (rejection) {
      if (rejection.status === 401) {
        // handle the case where the user is not authenticated
      }
      return $q.reject(rejection);
    }
  };
})
.config(function ($httpProvider) {
  $httpProvider.interceptors.push('authInterceptor');
});
