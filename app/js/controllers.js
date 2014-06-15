'use strict';

/* Global Object */
//var sosMap;
//var mapOptions;
var geo = new google.maps.Geocoder; //Posicao inicial do mapa

/* Controllers */
var SoSCtrls = angular.module('sosWeb.controllers', ['ui.bootstrap','ui.map','ui.event']);

/* Main page Ctrl */
SoSCtrls.controller('MainCtrl', ['$scope', '$http', '$location', '$modal',
	'Alerts', 'ServiceTpServico',  'Authentication', '$log',
function($scope, $http, $location, $modal, Alerts, ServiceTpServico, Authentication, $log) {
	$scope.gPlace;
	$scope.tipoServico;
	$scope.endereco;
	$scope.raio;
	$scope.user = Authentication.currentUser();
	$scope.prestador = {
			email: '',
			cpf: '',
		    telefone: '',
		    logradouro: '',
		    numero: 0,
		    complemento: '',
		    cep: '',
		    cidade: '',
		    estado: ''
	};
	
	$scope.servico = {
			descricao: '',
		    valor: 0.0,
		    nome_tipo_servico: '',
		    usuario_email: ''
	};
	

	$scope.search = function() {
		$location.path(
			'/busca/tipoServico/'+$scope.tipoServico+
			'/endereco/'+$scope.endereco+
			'/raio/'+$scope.raio);
	};

	$scope.tiposServicos = new Array();
	ServiceTpServico.getTiposServicos().then(
		function(data) { $scope.tiposServicos = data; }
	);

	$scope.labels = {
		"filtrar_resultado": "Filtrar prestadores...",
		"prestadores_encontrados": "Prestadores encontrados",
		"endereco": "Endereço",
		"buscar": "Buscar",
	};

	//Alerts na pagina principal
	$scope.alerts = Alerts.getAll();
	$scope.closeAlert = function(index) {Alerts.removeAlert(index);};

	$scope.openAnuncio = function () {
		
		if($scope.user.logado){	
			$http({
				method: 'GET',
				url: 'http://soservices.vsnepomuceno.cloudbees.net/prestador/email?email='+$scope.user.email}).
		    	success(function(data, status, headers, config, prest) {
		    		if (data.cpf != data.email) {
		    			$scope.openCadastroAnuncio();
		    		} else {
		    			$scope.openCadastroPrestador();
		    		}
			    }).
			    error(function(data, status, headers, config) {		
			    	Alerts.addAlert('Erro: ' + status +' '+ data, 'danger');
			    });			
		}else{
			$scope.openLogin(true);
		}
	};
	
	$scope.openLogin = function (fromAnuncio) {
		var modalInstance;
		modalInstance = $modal.open({
			  templateUrl: 'partials/login.html',
			  controller: 'LoginCtrl',
			  resolve: {
			    user: function () {
			      return $scope.user;
			    }
			  }
		});
		modalInstance.result.then(function(data) {
			if (data != '') {
				$scope.user.logado = true;
				$scope.user.senha='';
				$scope.user.apiKey = data.apiKey;
				Authentication.login($scope.user);
				Alerts.closeAll();
				$scope.$apply();
				if (fromAnuncio) {
					$scope.openAnuncio();
				}
				
			}
		}, function() {
		});
	};
	
	$scope.logout = function () {
		$http({
			method : 'DELETE',
			url : 'http://soservices.vsnepomuceno.cloudbees.net/token/logout/'+$scope.user.email,
			data : $scope.user,
			headers: {'Content-Type': 'application/json'}
		}).
		success(function(data, status, headers, config) {
			$scope.user.nome='';
			$scope.user.email='';
			$scope.user.senha='';
			$scope.user.logado = false;
			$scope.user.apiKey = '';
			Authentication.logout($scope.user);
			$scope.$apply();

		}).error(function(data, status, headers, config) {
			Alerts.addAlert('Erro: ' + status + ' ' + data, 'danger');
		});    	  
	};
	
	$scope.openCadastro = function () {
		var modalInstance;
		modalInstance = $modal.open({
			  templateUrl: 'partials/cadastrarUsuario.html',
			  controller: 'cadastrarCtrl',
			  resolve: {
			    user: function () {
			      return $scope.user;
			    }
			  }
		});
		modalInstance.result.then(function(data) {
			if (data != '') {
				$scope.user.logado = true;
				$scope.user.senha='';
				$scope.user.confirmarsenha='';
				$scope.user.apiKey = data.apiKey;
				Authentication.login($scope.user);
				Alerts.closeAll();
				$scope.$apply();
				Alerts.addAlert('Usuário cadastrado com sucesso!', 'success');
				
			}
		}, function() {
		});
	};
	
	$scope.openCadastroPrestador = function () {
		var modalInstance;
		modalInstance = $modal.open({
			  templateUrl: 'partials/cadastrarPrestador.html',
			  controller: 'cadastroPrestadorCtrl',
			  resolve: {
				    prestador: function () {
				    	$scope.prestador.email = $scope.user.email;
				        return $scope.prestador;
				    }
			  }
			});
			modalInstance.result.then(function () {
				Alerts.addAlert('Prestador cadastrado com sucesso!', 'success');
				$scope.openCadastroAnuncio();
			}, 
			function () {

		});
	};
	
	$scope.openCadastroAnuncio = function () {
		var modalInstance;
		modalInstance = $modal.open({
			  templateUrl: 'partials/anunciar.html',
			  controller: 'anuncioCtrl',
			  resolve: {
				servico: function () {
					$scope.servico.usuario_email = $scope.user.email;
			        return $scope.servico;
			    },
			    tiposServicos: function () {
			        return $scope.tiposServicos;
			    }
			  }
			});
			modalInstance.result.then(function () {
				Alerts.addAlert('Anuncio cadastrado com sucesso!', 'success');
			}, 
			function () {

		});
	};
}]);

/* Ctrl Busca de prestadores */
SoSCtrls.controller('PrestadoresCtrl', ['$scope', '$http', '$location', '$routeParams',
	'Alerts', 'ServicePrestadores', 'ServiceTpServico',
	function($scope, $http, $location, $routeParams, Alerts, ServicePrestadores, ServiceTpServico) {
	 	$scope.tipoServico = $routeParams.tipoServico;
		$scope.endereco = $routeParams.endereco;
		$scope.raio = $routeParams.raio;

		$scope.prestadores = [];

		$scope.maxRate = 10;

		//Filter and order
		$scope.orderProp = '-avaliacao';
		$scope.orderBy = function (orderProp) {
			$scope.orderProp = orderProp;
		};

		//Pagination
		$scope.itemsPerPage = 1;
		$scope.setPage = function (pageNo) {
			$scope.currentPage = pageNo;
		};
		$scope.pageChanged = function() {
			$scope.currentPage
		};

		//Inicializa o mapa
		$scope.userLocation;
		var ll = new google.maps.LatLng(-7.9712137, -34.839565100000016);
	    $scope.mapOptions = {
	        center: ll,
	        zoom: 15,
	        mapTypeId: google.maps.MapTypeId.ROADMAP
	    };

		$scope.getPesquisadores = function() {
			geo.geocode({'address':$scope.endereco},function(results, status){
	          	if (status == google.maps.GeocoderStatus.OK) {
					$scope.userLocation = results[0].geometry.location;
	        		ll = new google.maps.LatLng($scope.userLocation.lat(), $scope.userLocation.lng());
	        		
	        		//Recupera o ID do tipo de servico
	        		ServiceTpServico.getIdByName($scope.tipoServico).then(
						function(idTpServico) { 
			        		//Busca os prestadores de servicos
			        		ServicePrestadores.getPrestadores(
			        			idTpServico, //Encontrar maneira de trocar nome para id
			        			$scope.userLocation.lat(), 
			        			$scope.userLocation.lng(),
			        			($scope.raio * 1000), //API esta em metros e nao KM.
			        			function(data) {
									$scope.prestadores = data;

							    	//TODO: Alterar variaveis quando realizar link com paginacao
									$scope.bigTotalItems = $scope.prestadores.length;
									$scope.bigCurrentPage = 1;

									// alert('Chamando carrega mapa..');
								    $scope.carregarMapa(ll);
							    }
							);
						}
					);
	          	} else {
	          		Alerts.addAlert(
	          			"Geocode was not successful for the following reason: " + status, 'danger');
	          	}
		    });
		};

		$scope.carregarMapa = function(center) {
			//Clean old markers
			angular.forEach($scope.myMarkers, function(marker) {
			    marker.setMap(null);
			});

        	$scope.myMarkers = new Array();
	        //Adiciona marcadores para cada prestador encontrado
	        var i;
	    	for (i = 0; i < $scope.prestadores.length; ++i) {
				var newMarker = 
		            $scope.myMarkers.push(
		            	new google.maps.Marker({
			                map: $scope.sosMap,
			                position: new google.maps.LatLng(
								$scope.prestadores[i].endereco.latitude,
								$scope.prestadores[i].endereco.longitude),
			                icon: 'img/map_icon_prest.png'
		            	})
		            );
			}

	        $scope.myMarkers.push(
	        	new google.maps.Marker({
		            map: $scope.sosMap,
		            position: center
	        	})
	        );

        	alert($scope.myMarkers);

        	$scope.sosMap.panTo(center); //Centraliza o mapa no endereço informado.

		}

		if($scope.tipoServico && $scope.endereco && $scope.raio){
			$scope.getPesquisadores();
		}	

	    $scope.markerClicked = function(m) {
	        window.alert("clicked");
	    };
	}
]);

//Controler Example
SoSCtrls.controller('MyCtrl2', ['$scope', function($scope) {
}]);

//Controla o dialog de "sign in" / "sign up"
var LoginCtrl = function ($scope, $http, $modalInstance, Alerts, user) {
	
  $scope.user = user;
			
  $scope.logar = function () {	 
	  
	    if ( $scope.user.email != '' && $scope.user.senha != null) {
			$http({
				method : 'POST',
				url : 'http://soservices.vsnepomuceno.cloudbees.net/token/login',
				data : $scope.user,
				headers: {'Content-Type': 'application/json'}
			}).
			success(function(data, status, headers, config) {
				$modalInstance.close(data);
	
			}).error(function(data, status, headers, config) {
				Alerts.addAlert('Erro: ' + status + ' ' + data, 'danger');
			});    
	    } 
  };

  $scope.cancel = function () {
	limparUsuario(user);
    $modalInstance.dismiss('cancel');
  };
};

//Controla o dialog de cadastro
var cadastrarCtrl = function ($scope, $http, $modalInstance, Alerts, user) {
	
  $scope.user = user;
			
  $scope.cadastrar = function () {	 
	  
	 if ( $scope.user.email != '' && $scope.user.senha != null && 
			 $scope.user.nome != '' && $scope.user.confirmarsenha != null && 
			 $scope.user.senha != '' && $scope.user.confirmarsenha != '') {
		 if (angular.equals($scope.user.senha, $scope.user.confirmarsenha) ) {
			$http({
				method : 'POST',
				url : 'http://soservices.vsnepomuceno.cloudbees.net/prestador/usuario',
				data : $scope.user,
				headers: {'Content-Type': 'application/json'}
			}).
			success(function(data, status, headers, config) {
				$modalInstance.close(data);
			
			}).error(function(data, status, headers, config) {
				Alerts.addAlert('Erro: ' + status + ' ' + data, 'danger');
			});    
		 }else {
		    	Alerts.addAlert('Senha e confirmação diferentes!');
	      }
	  }
  };

  $scope.cancel = function () {
    limparUsuario(user);
    $modalInstance.dismiss('cancel');
  };
};

//Controla o dialog de cadastro
var cadastroPrestadorCtrl = function ($scope, $http, $modalInstance, Alerts, prestador) {
	
  $scope.prestador = prestador;
			
  $scope.cadastrar = function () {	 
	  
	 if ($scope.prestador.cpf != '' && $scope.prestador.cpf != null ) {
		 $http({
				method : 'PUT',
				url : 'http://soservices.vsnepomuceno.cloudbees.net/prestador',
				data : $scope.prestador,
				headers: {'Content-Type': 'application/json'}
			}).
			success(function(data, status, headers, config) {
				$modalInstance.close(data);			
			}).error(function(data, status, headers, config) {
				Alerts.addAlert('Erro: ' + status + ' ' + data, 'danger');
			});
	  }
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
};


//Controla o dialog de anuncio de servicos
var anuncioCtrl = function ($scope, $http,$modalInstance, Alerts, servico, tiposServicos) {
	$scope.servico = servico;
	$scope.tiposServicos = tiposServicos;
	
	$scope.cadastrar = function () {
		$http({
			method : 'POST',
			url : 'http://soservices.vsnepomuceno.cloudbees.net/servico',
			data : $scope.servico,
			headers: {'Content-Type': 'application/json'}
		}).
		success(function(data, status, headers, config) {
			$modalInstance.close(data);
		
		}).error(function(data, status, headers, config) {
			Alerts.addAlert('Erro: ' + status + ' ' + data, 'danger');
		});    
	};
	
	$scope.cancel = function () {
		 $modalInstance.dismiss('cancel');
	};
};

var limparUsuario = function(user) {
	user.nome='';
	user.email='';
	user.senha='';
	user.confirmarsenha='';
};