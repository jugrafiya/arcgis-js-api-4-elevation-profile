require([
    "esri/Map",
    "esri/views/MapView",
    "esri/views/2d/draw/Draw",
    "esri/Graphic",
    "esri/geometry/geometryEngine",
    "esri/tasks/Geoprocessor",
    "esri/tasks/support/FeatureSet"
], function(
    Map, MapView, Draw, Graphic, geometryEngine, Geoprocessor, FeatureSet
) {
    const map = new Map({
        basemap: "gray"
    });

    var chart=''

    const view = new MapView({
        container: "viewDiv",
        map: map,
        zoom: 14,
        center: [73.0479, 33.6844]
    });

    // add the button for the draw tool
    view.ui.add("line-button", "top-left");
    view.ui.add("chart-div", "bottom-left");

    const draw = new Draw({
        view: view
    });

    // draw polyline button
    document.getElementById("line-button").onclick = function() {
        view.graphics.removeAll();

        // creates and returns an instance of PolyLineDrawAction
        const action = draw.create("polyline");

        // focus the view to activate keyboard shortcuts for sketching
        view.focus();

        // listen polylineDrawAction events to give immediate visual feedback
        // to users as the line is being drawn on the view.
        action.on(["vertex-add", "vertex-remove", "cursor-update", "redo",
            "undo", "draw-complete"
        ], updateVertices);

        action.on(["draw-complete"], drawCommplete);
    }

    function drawCommplete(event) {
        // console.log("Geometry is Completed")
        gp = new Geoprocessor("https://elevation.arcgis.com/arcgis/rest/services/Tools/ElevationSync/GPServer/Profile");
        // gp.setOutputSpatialReference({
        //       wkid: 102100
        //     });



        const vertices = event.vertices;
        const graphic = new Graphic({
            geometry: {
                type: "polyline",
                paths: vertices,
                spatialReference: view.spatialReference
            },
            symbol: {
                type: "simple-line", // autocasts as new SimpleFillSymbol
                color: [4, 90, 141],
                width: 4,
                cap: "round",
                join: "round"
            }
        });

        console.log(graphic)

        // Creating feature set from the graphic layer

        var features = [];
        features.push(graphic);
        var featureSet = new FeatureSet();
        featureSet.features = features;

        console.log(featureSet.features[0].geometry.extent.width)
        if ((featureSet.features[0].geometry.extent.width/1609.344)>30   )
        {
          sampleDistance= 1
        }
        else {
          sampleDistance= 0.0621371

        }

        params = {
            "env:outSR": 4326,
            "InputLineFeatures": featureSet,
            "DEMResolution": 'FINEST',
            "MaximumSampleDistance": sampleDistance, //10.310196668292074,
            "MaximumSampleDistanceUnits": "Miles",
            "returnZ": true,
            "returnM": true

        }
        document.getElementById("loading").style.display="block"
        gp.execute(params).then(function(e) {
            console.log(e)
            document.getElementById("loading").style.display="none"

            generateGraphDetails(sampleDistance, e.results[0].value.features[0].geometry.paths, e.results[0].value.features[0].attributes.ProfileLength)


        })


    }
    // Checks if the last vertex is making the line intersect itself.
    function updateVertices(event) {
        // create a polyline from returned vertices
        const result = createGraphic(event);

        // if the last vertex is making the line intersects itself,
        // prevent the events from firing
        if (result.selfIntersects) {
            event.preventDefault();
        }
    }

    // create a new graphic presenting the polyline that is being drawn on the view
    function createGraphic(event) {
        const vertices = event.vertices;
        view.graphics.removeAll();

        // a graphic representing the polyline that is being drawn
        const graphic = new Graphic({
            geometry: {
                type: "polyline",
                paths: vertices,
                spatialReference: view.spatialReference
            },
            symbol: {
                type: "simple-line", // autocasts as new SimpleFillSymbol
                color: [4, 90, 141],
                width: 4,
                cap: "round",
                join: "round"
            }
        });

        // check if the polyline intersects itself.
        const intersectingSegment = getIntersectingSegment(graphic.geometry);

        // Add a new graphic for the intersecting segment.
        if (intersectingSegment) {
            view.graphics.addMany([graphic, intersectingSegment]);
        }
        // Just add the graphic representing the polyline if no intersection
        else {
            view.graphics.add(graphic);
        }

        // return intersectingSegment
        return {
            selfIntersects: intersectingSegment
        }
    }

    // function that checks if the line intersects itself
    function isSelfIntersecting(polyline) {
        if (polyline.paths[0].length < 3) {
            return false
        }
        const line = polyline.clone();

        //get the last segment from the polyline that is being drawn
        const lastSegment = getLastSegment(polyline);
        line.removePoint(0, line.paths[0].length - 1);

        // returns true if the line intersects itself, false otherwise
        return geometryEngine.crosses(lastSegment, line);
    }

    // Checks if the line intersects itself. If yes, change the last
    // segment's symbol giving a visual feedback to the user.
    function getIntersectingSegment(polyline) {
        if (isSelfIntersecting(polyline)) {
            return new Graphic({
                geometry: getLastSegment(polyline),
                symbol: {
                    type: "simple-line", // autocasts as new SimpleLineSymbol
                    style: "short-dot",
                    width: 3.5,
                    color: "yellow"
                }
            });
        }
        return null;
    }

    // Get the last segment of the polyline that is being drawn
    function getLastSegment(polyline) {
        const line = polyline.clone();
        const lastXYPoint = line.removePoint(0, line.paths[0].length - 1);
        const existingLineFinalPoint = line.getPoint(0, line.paths[0].length -
            1);

        return {
            type: "polyline",
            spatialReference: view.spatialReference,
            hasZ: false,
            paths: [
                [
                    [existingLineFinalPoint.x, existingLineFinalPoint.y],
                    [lastXYPoint.x, lastXYPoint.y]
                ]
            ]
        };
    }

    function generateGraphDetails(sampleDistance, in_data,profile_length) {
      var profLength= profile_length
      var factor= 0
      if (profLength< 1000)
      {
        factor=100
      }
      else {
        factor= 1000
      }
      // console.log(profile_length)
        var elev_points = []
        var elev_labels = []
        var elev_zvalue = []
        for (var i = 0; i < in_data[0].length; i++) {
            elev_points.push((in_data[0][i][2])/3.2808)
            elev_zvalue.push(in_data[0][i][3])
            elev_labels.push(i)
            // console.log(elev[0][i][2])

        }
        // console.log(elev_points)

        var xaxisindex = 0;

        var config = {
            type: 'line',
            data: {
                labels: elev_labels,
                datasets: [{
                    label: 'Elevation Profile Dataset',
                    data: elev_points,
                    pointHoverRadius: 5
                }]
            },
            options: {
                elements: {
                    point: {
                        radius: 0
                    }
                },
                responsive: true,
                title: {
                    display: true,
                    text: 'Elevation Profile'
                },
                tooltips: {
                      mode : 'index',
                      callbacks: {
                              label: function(tooltipItem, data) {

                                // console.log(in_data[0][tooltipItem.index])
                                // console.log(tooltipItem)
                                var point = {
                                        type: "point", // autocasts as new Point()
                                        longitude: in_data[0][tooltipItem.index][0], //73.008168, //in_data[0][tooltipItem.index][1],
                                        latitude: in_data[0][tooltipItem.index][1] //33.683328 //in_data[0][tooltipItem.index][0]
                                      };

                                      var markerSymbol = {
                                        type: "simple-marker", // autocasts as new SimpleMarkerSymbol()
                                        color: [4, 90, 141],
                                        outline: { // autocasts as new SimpleLineSymbol()
                                          color: [255, 255, 255],
                                          width: 2
                                        }
                                      };

                                      view.graphics.remove(pointGraphic);
                                      // Create a graphic and add the geometry and symbol to it
                                      var pointGraphic = new Graphic({
                                        geometry: point,
                                        symbol: markerSymbol,
                                        spatialReference: view.spatialReference
                                      });

                                      mapGraphics= view.graphics
                                      // debugger;
                                      for (var i=0 ; i < mapGraphics.items.length; i++)
                                      {
                                        if (i!=0)
                                        {
                                          view.graphics.remove(mapGraphics.items[i])
                                        }
                                      }

                                      view.graphics.add(pointGraphic);
                                      console.log(tooltipItem)

                                  return tooltipItem.value
                                  // return label;
                              }
                          }

                },
                hover: {
                  mode: 'nearest',
                  intersect: false
                },
                scales: {
                    xAxes: [{
                        ticks: {
                            userCallback: function(item, index) {

                                if (index == 0) {

                                    xaxisindex = 0;
                                    return index

                                }
                                else
                                if (!(index % 10))
                                 {
                                   // debugger;
                                    // factor_value+=1000
                                    // xaxisindex+=increment
                                    // console.log(factor_value)
                                    xaxist= ++xaxisindex;
                                    if (sampleDistance >= 1)
                                    {
                                        return xaxist*10
                                    }
                                    else {
                                      return xaxist
                                    }


                                }
                            },
                            autoSkip: false
                        },
                        scaleLabel: {
                            display: true,
                            labelString: 'Distance in Miles'
                        }
                    }],
                    yAxes: [{
                        stacked: true,
                        ticks: {
                            suggestedMin: 0,
                            steps: 10,
                            // stepValue: 5,
                            min: Math.min.apply(null, elev_points)
                        },
                        scaleLabel: {
                            display: true,
                            labelString: 'Elevation in Feet'
                        }
                    }]
                }
            }
        };

        document.querySelector("#chart-div").innerHTML = '<canvas id="canvas" style="height: 15em; width: 85em;"></canvas>';
        var ctx = document.getElementById('canvas').getContext('2d');

        var chart = new Chart(ctx, config);
        // chart.destroy()
        // var ctx = document.getElementById('canvas').getContext('2d');
        var chart = new Chart(ctx, config);


    }



});
