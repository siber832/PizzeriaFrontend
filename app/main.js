const application = angular.module("Pizzeria", ['ngMaterial', 'ngRoute', 'ngCookies', 'ngFileChange'], function($httpProvider){
    // Use x-www-form-urlencoded Content-Type
    $httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
    /**
     * The workhorse; converts an object to x-www-form-urlencoded serialization.
     * @param {Object} obj
     * @return {String}
     */
    var param = function(obj) {
        var query = '', name, value, fullSubName, subName, subValue, innerObj, i;

        for(name in obj) {
            value = obj[name];

            if(value instanceof Array) {
                for(i=0; i<value.length; ++i) {
                    subValue = value[i];
                    fullSubName = name + '[' + i + ']';
                    innerObj = {};
                    innerObj[fullSubName] = subValue;
                    query += param(innerObj) + '&';
                }
            }
            else if(value instanceof Object) {
                for(subName in value) {
                    subValue = value[subName];
                    fullSubName = name + '[' + subName + ']';
                    innerObj = {};
                    innerObj[fullSubName] = subValue;
                    query += param(innerObj) + '&';
                }
            }
            else if(value !== undefined && value !== null)
                query += encodeURIComponent(name) + '=' + encodeURIComponent(value) + '&';
        }

        return query.length ? query.substr(0, query.length - 1) : query;
    };

    // Override $http service's default transformRequest
    $httpProvider.defaults.transformRequest = [function(data) {
        return angular.isObject(data) && String(data) !== '[object File]' ? param(data) : data;
    }];
});

application.run(['$rootScope', '$location', '$http', '$cookies', '$mdToast', '$timeout', '$mdSidenav', function($rootScope, $location, $http, $cookies, $mdToast, $timeout, $mdSidenav) {
    $rootScope.user = null;

    if ($cookies.getObject('session')) {
        $rootScope.user = $cookies.getObject('session');
    }

    $rootScope.logout = () => {
        $http.post("http://localhost:50120/Pizzas/logout", {}).then( (response) => {
            $cookies.remove('session');
            $rootScope.user = null;

            $mdToast.show({
                template: '<md-toast class="md-toast success">Sesion cerrada correctamente</md-toast>',
                hideDelay: 6000,
                position: 'bottom'
            });

            $location.path('/acceder');
        }, (errResponse) => {
            console.log("Respuesta Erroraaaa: %o", errResponse);
        });
    };

    $rootScope.toggleMenu = buildDelayedToggler('leftMenu');

    /**
     * Supplies a function that will continue to operate until the
     * time is up.
     */
    function debounce(func, wait, context) {
        var timer;

        return function debounced() {
            var context = $rootScope,
                args = Array.prototype.slice.call(arguments);
            $timeout.cancel(timer);
            timer = $timeout(function() {
                timer = undefined;
                func.apply(context, args);
            }, wait || 10);
        };
    }

    /**
     * Build handler to open/close a SideNav; when animation finishes
     * report completion in console
     */
    function buildDelayedToggler(navID) {
        return debounce(function() {
            // Component lookup should always be available since we are not using `ng-if`
            $mdSidenav(navID)
                .toggle()
                .then(function () {
                    console.log("toggle " + navID + " is done");
                });
        }, 200);
    }
}]);

/**
 * Setting up the router configuration.
 */


application.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    // General
    $routeProvider
        .when('/', {
            redirectTo: '/pizzas'
        })
        .when('/pizzas', {
            templateUrl: '/danie-angular-md-pizzeria/views/pizzas.html',
            controller: function($scope, $http, $sce, $location) {
                if($scope.user == null) {
                    $location.path('/acceder');
                }
                $scope.pizzas = [];

                $http.get("http://localhost:50120/Pizzas/pizzas").then( (response) => {
                    $scope.pizzas = response.data;
                }, (errResponse) => {
                    console.log("Respuesta Error: %o", errResponse);
                });

                $scope.trustSrc = function(src) {
                    return $sce.trustAsResourceUrl(src);
                };
            }
        })
        .when('/pizza/:nombre', {
            templateUrl: '/danie-angular-md-pizzeria/views/pizza_details.html',
            //template: 'El nombre de la pizza es <strong>{{ nomPicha }}</strong>',
            controller: function($http, $scope, $routeParams, $mdToast) {
                if($scope.user == null) {
                    $location.path('/acceder');
                }
                $scope.idPizza = $routeParams.nombre.replace(":", "")
                $http.get("http://localhost:50120/Pizzas/pizza?id=" + $scope.idPizza, {
                }).then( (response) => {
                    $scope.pizza = response.data
                }, (errResponse) => {
                    console.log("Respuesta Error: %o", errResponse);
                });
                $scope.submit = function() {
                    $http.post("http://localhost:50120/Pizzas/comment", {
                        pizzaId : $scope.idPizza,
                        userId: $scope.user.id,
                        comentario: $scope.comment,
                        puntuacion: $scope.rating
                    }).then( (response) => {
                        $mdToast.show($mdToast.simple().textContent('Comentario agregado correctamente'));
                    }, (errResponse) => {
                        $mdToast.show($mdToast.simple().textContent('Error en el acceso: ' + errResponse.data));
                    });
                }
            }
        })
        .when('/insertar_pizza', {
            templateUrl: '/danie-angular-md-pizzeria/views/new_pizza.html',
            controller: function($scope, $http, $mdToast, $location) {
                if($scope.user == null) {
                    $location.path('/acceder');
                }
                $scope.ingredientes = [];
                $scope.nuevoIngrediente = '';
                $scope.nuevoIngredientePrecio = 0.12;

                $scope.addIngredient = () => {
                    $scope.ingredientes.push({
                        nombre: $scope.nuevoIngrediente,
                        precio: $scope.nuevoIngredientePrecio
                    });
                    $scope.nuevoIngrediente = '';
                    $scope.nuevoIngredientePrecio = 0.12
                };

                $scope.deleteIngredient = (ingrediente) => $scope.ingredientes.splice($scope.ingredientes.indexOf(ingrediente), 1);

                $scope.file = null;
                /**
                 * Cuando el archivo cambia se muestra la previsualizacion y se añade a los datos del formulario a enviar.
                 * @param element
                 */
                $scope.setFile = function(element) {
                    $scope.currentFile = element.files[0];
                    let reader = new FileReader();

                    reader.onload = function(event) {
                        $scope.image_source = event.target.result;
                        $scope.$apply();

                    };
                    // when the file is read it triggers the onload event above.
                    reader.readAsDataURL(element.files[0]);
                };

                $scope.fileChanged = (event) => {
                    let input = event.target;
                    $scope.file = input.files[0];

                };

                $scope.submit = function() {

                    let formData = new FormData();
                    formData.append('name', $scope.nombrePizza);

                    console.log("Ingredientes: %o", $scope.ingredientes);

                    if ($scope.file !== null)
                        formData.append('f', $scope.file, $scope.file.name);

                    $http.post("http://localhost:50120/Pizzas/insert_pizza", formData, {
                        transformRequest: angular.identity,
                        headers: {
                            'Content-Type': undefined
                        }
                    }).then( (response) => {
                        for(let i=0; i<$scope.ingredientes.length; i++) {
                            let price = $scope.ingredientes[i].precio.toString().replace(",", ".")
                            $http.post("http://localhost:50120/Pizzas/ingredient", {
                                pizzaId: response.data,
                                nombre: $scope.ingredientes[i].nombre,
                                precio: price
                            }).then( (response) => {
                                $mdToast.show($mdToast.simple().textContent('Ingrediente insertado correctamente'));
                                if($scope.ingredientes.length == i-1) {
                                    $http.post("http://localhost:50120/Pizzas/ingredients_end", {
                                    }).then( (response) => {
                                        $mdToast.show($mdToast.simple().textContent('Datos guardados correctamente'));
                                    }, (errResponse) => {
                                        $mdToast.show($mdToast.simple().textContent('Error al insertar guardar datos'));
                                    });
                                }
                            }, (errResponse) => {
                                $mdToast.show($mdToast.simple().textContent('Error al insertar el ingrediente'));
                            });
                        }

                        $mdToast.show($mdToast.simple().textContent('Pizza insertada correctamente'));
                    }, (errResponse) => {
                        $mdToast.show($mdToast.simple().textContent('Error al insertar la pizza'));
                    });
                };
            }

        })
        .otherwise({
            redirectTo: '/'
        });

    // Acceso de usuarios
    $routeProvider
        .when('/acceder', {
            templateUrl: '/danie-angular-md-pizzeria/views/acceder.html',
            controller: function($rootScope, $scope, $http, $mdToast, $cookies, $location) {
                if ($cookies.get('session'))
                    $location.path('/');

                $scope.login = function() {
                    $http.post("http://localhost:50120/Pizzas/login", {
                        user : $scope.username,
                        password: $scope.password
                    }).then( (response) => {
                        let data = {
                            username: $scope.username,
                            id: response.data
                        };
                        $cookies.put('session', JSON.stringify(data));
                        $rootScope.user = {
                            username: $scope.username,
                            id: response.data
                        };

                        $mdToast.show({
                            template: '<md-toast class="md-toast success">Bienvenido!</md-toast>',
                            hideDelay: 6000,
                            position: 'bottom'
                        });

                        $location.path('/');
                    }, (errResponse) => {
                        $mdToast.show($mdToast.simple().textContent('Error en el acceso: ' + errResponse.data));
                    });
                };
            }
        })
        .when('/nuevo_usuario', {
            templateUrl: '/danie-angular-md-pizzeria/views/register_user.html',
            controller: function($scope, $http, $mdToast) {
                $scope.submit = function() {
                    $http.post("http://localhost:50120/Pizzas/register", {
                        user : $scope.username,
                        password: $scope.password,
                        name: $scope.name,
                        surname: $scope.surname,
                        email: $scope.email
                    }).then( (response) => {
                        $mdToast.show($mdToast.simple().textContent('Registrado correctamente'));
                    }, (errResponse) => {
                        $mdToast.show($mdToast.simple().textContent('Error en el registro'));
                    });

                }
            }
        });
}]);