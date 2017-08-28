/**
 * Created by Asier on 03/03/2017.
 */
var app = angular.module('ngFileChange', []);

/**
 * File Input change event
 */
app.directive('ngFileChange', function() {
    return {
        scope: {
            ngFileChange: "&"
        },
        link: function($scope, $element, $attrs){
            $element.on("change", function(event) {
                $scope.ngFileChange({
                    $event: event
                });
            });

            $scope.$on("$destroy",function(){
                $element.off();
            });
        }
    };
});