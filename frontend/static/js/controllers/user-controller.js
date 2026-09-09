var app = angular.module('pizza');

app.controller('UserCtrl', function ($scope, $window, $rootScope, auth) {
  $scope.user = {username: '', password: ''};
  $scope.isAuthenticated = auth.isAuthenticated();
  $rootScope.authInfo = {username: auth.username()};

  $scope.login = function () {
    auth.login($scope.user.username, $scope.user.password)
      .then(function () {
        $scope.isAuthenticated = true;
        $rootScope.authInfo = {username: auth.username()};
        $scope.user.password = '';
        $scope.error = '';
      })
      .catch(function () {
        $scope.isAuthenticated = false;
        $scope.error = 'Error: Invalid user or password';
      });
  };

  $scope.logout = function () {
    auth.logout();
    $scope.isAuthenticated = false;
    $scope.user = {username: '', password: ''};
    $rootScope.authInfo = {username: ''};
    $window.location.href = '#/';
  };
});
