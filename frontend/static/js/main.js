angular.module('pizza', ['ngRoute', 'ngResource'])
.config(function($routeProvider, $locationProvider){
  $locationProvider.html5Mode(false);
  $routeProvider.when('/', {
    templateUrl: 'static/partials/home.html'
  })
  .when('/about', {
    templateUrl: 'static/partials/about.html',
  })
  .when('/orders', {
    templateUrl: 'static/partials/orders.html',
    controller: 'OrdersCtrl',
  })
  .when('/new-order', {
    templateUrl: 'static/partials/new-order.html',
    controller: 'NewOrderCtrl',
  })
  .when('/orders/:id/:new', {
    templateUrl: 'static/partials/order.html',
    controller: 'GetOrderCtrl',
  });
})
.run(function($rootScope) {
  // Set in static/js/config.js, which the container rewrites at start-up.
  $rootScope.APIURL = window.PIZZA_API_URL;
})
.config(['$resourceProvider', function($resourceProvider) {
  // Don't strip trailing slashes from calculated URLs
  $resourceProvider.defaults.stripTrailingSlashes = false;
}]);
