
(function($){
    "use strict";
    
    /*
     *  Im kompletten Scope und Unterscopes gültige Variablen,
     *      um bei Veränderungen der Viewport-Größe diese dem D3.js-Layout mitzuteilen
     *      bzw. das Ausgabe-Element dynamisch der Viewport-Größe anzupassen 
     */
    var force = null;
    var vizsvg = null;
    
    /* Variable, die das SVG-Element im DOM referenziert, in dem die Verlaufsgrafiken ausgegeben werden */
    var frequencyvizsvg = null;
    
    /* "Globale" Variable um Zugriff auf das Popup-Element zu haben */
    var abstract_text_popup = null;
    
    /* Vorgefertigte Datenstruktur für die Nodes (Knoten) und Lines (Kanten) */
    var graph = {
        "nodes":[],
        "links":[]
    };
    
    var frequency_overlay = null;
    
    
    /* Hilfsvariablen, um das kleineste und größte Jahr sowie den kleinsten und größten Häufigkeitswert feestzuhalten */
    var years_min_max = {min: null, max: null};
    var frequency_min_max = {min: null, max: null};
    var max_num_mentioned = null;
    
    /* Liste von Autoren */
    var authors = null;

    
    /*
     *  JSON-Dokument mit den Topics beziehen und in die zuvor definierte Datensturktur einpflegen
     *      (momentan kann nur Firefox lokale Dateien per XHR beziehen)
     */
    $.getJSON('./data/samplemin.json', function(json) {
        
        authors = json.authors;
        
        var id_index_map = {};
        
        var runner = 0;
        
        $.each(json.topics, function(i, v) {
            var num_in_years_mentioned = 0;
            var num_overall_mentioned = 0;
            
            for(var j in v.frequency_per_year) {
                if(v.frequency_per_year.hasOwnProperty(j)) {
                    num_overall_mentioned += v.frequency_per_year[j];
                    num_in_years_mentioned++;
                }
            }
            
            
            // num_in_years_mentioned // könnte evtl. auch als Filterparameter herangezogen werden
            if(num_overall_mentioned < 2) // Schöne Stelle für ein Threshold
                return;
            
            v.num_overall_mentioned = num_overall_mentioned;
            
            if(max_num_mentioned == null || num_overall_mentioned > max_num_mentioned)
                max_num_mentioned = num_overall_mentioned;
            
            graph.nodes.push(v);
            id_index_map[v.id] = runner;
            runner++;
            
            /* Durch alle "Nodes" traversieren und das niedrigste und das höchste Jahr, sowie direkt auch die Häufigkeit */
            var node_years = v.frequency_per_year;

            $.each(node_years, function(i, v) {
                var year = parseInt(i);
                var frequency = v;

                if(years_min_max.min === null || year < years_min_max.min)
                    years_min_max.min = year;

                if(years_min_max.max === null || year > years_min_max.max)
                    years_min_max.max = year;

                if(frequency_min_max.min === null || frequency < frequency_min_max.min)
                    frequency_min_max.min = frequency;

                if(frequency_min_max.max === null || frequency > frequency_min_max.max)
                    frequency_min_max.max = frequency;
            });
        });
        
        
        /* Überprüfen, dass nicht bereits eine Kante in entgegengesetzter Richtung existiert */
        var unique_link = function(source, target) {
        
            var is_unique = true;
        
            $.each(graph.links, function(i, v) {
                if(v['source'] === target && v['target'] === source) {
                    is_unique = false;
                    return false;
                }
            });
            
            return is_unique;
        }
        
        $.each(graph.nodes, function(i, v) {
            
            /* Sicherheitshalber überprüfen, ob das Topic überhaupt Kanten zu anderen Topics besitzt */
            if(typeof(v.edges) === 'undefined')
                return true;
            
            $.each(v.edges, function(sub_i, sub_v) {
                
                if(     typeof(id_index_map[v.id]) !== 'undefined'
                    &&  typeof(id_index_map[sub_v.neighbour]) !== 'undefined'
                    &&  unique_link(id_index_map[v.id], id_index_map[sub_v.neighbour])) {
                    graph.links.push({  source: id_index_map[v.id],
                                        target: id_index_map[sub_v.neighbour],
                                        weight: sub_v.weight});
                }
            });
        });
        
        /* Ausgabe der Anzahl aller betrachteten Nodes und Kanten über die Konsole ausgeben */
        console.log("topics_count", graph.nodes.length);
        console.log("edges_count", graph.links.length);
        
        /* Den Graphen erst aufbauen, nachdem das JSON-Dokument geparst und alle relevanten Topics ausgewählt wurden */
        initGraph();
    })
    .error(function(e, i) {
        console.log(e, i);
    });
    
    
    /* Hilfsfunktion, um ein HSV- in ein RGB-Farbwert umzurechnen; da SVG keine HSV-Farbangabe unterstützt */
    /* http://de.wikipedia.org/wiki/HSV-Farbraum#Umrechnung_HSV_in_RGB */
    function hsl2rgb(h, s, l) {
        if(s == 0) {
            var val = l * 255;
            return rgb = [val, val, val];
        }
        
        var hi = h/60;
        var i = Math.floor(hi); 
        var f = hi - i;
        var p = l * (1 - s);
        var q = l * (1 - s * f);
        var t = l * (1- s * (1 - f));
        
        var r, g, b;
        
        switch(i) {
            case 0:
            case 6:
                r = l; g = t; b = p;
                break;
            case 1:
                r = q, g = l; b = p;
                break;
            case 2:
                r = p; g = l; b = t;
                break;
            case 3:
                r = p; g = q; b = l;
                break;
            case 4:
                r = t; g = p; b = l;
                break;
            case 5:
                r = l; g = p; b = q;
                break;
        }
    
        return [Math.ceil(r * 255), Math.ceil(g * 255), Math.ceil(b * 255)];
    }
    
    
    /* Linienfunktion, um, anhand eines Wertearrays, ein SVG-Pfad zu erzeugen */
    var line_function = function(data_arr, max_width, max_height, max_value) {
        
        /* Abstandsschritt zwischen den Pfadpunkten bestimmten */
        var width_step = max_width / data_arr.length;
        
        if(typeof(max_value) === 'undefined') {
            /* Den größten Wert im Wertearray bestimmen, um das Diagramm in seiner y-Achse zu skalieren */
            max_value = 0;
            for(var i = 0; i < data_arr.length; i++) {
                if(max_value < data_arr[i]) max_value = data_arr[i];
            }
        }
        
        /* Skalisrungsfaktor bestimmen */
        var resize_quot = max_height / max_value;
        
        var line_data = [];
        
        /* Untere Punkte des Pfads berechnen (hin ->) */
        for(var i = 0; i < data_arr.length; i++) {
            line_data.push({"x": width_step * i, "y": max_height + data_arr[i] * resize_quot });
        }
        
        /* Zwei Punkte am Ende, um einen mehr oder wenigen glatten Schnitt zu erreichen */
        line_data.push({"x": width_step * (data_arr.length - 1) + 7, "y": max_height - 10 + data_arr[data_arr.length - 1] * resize_quot });
        line_data.push({"x": width_step * (data_arr.length - 1) + 7, "y": max_height + 10 - data_arr[data_arr.length - 1] * resize_quot });
        
        /* Oberen Punkte bestimmten (zurück <-) */
        for(var i = data_arr.length-1; i >= 0; i--) {
            line_data.push({"x": width_step * i, "y": max_height - data_arr[i] * resize_quot });
        }
        
        /* Letzten Punkt setzen, damit ein glatter Schnitt am Anfang erreicht wird */
        line_data.push({"x": 0 , "y": max_height - data_arr[0] * resize_quot });
        
        /* Von d3.js bereitgestellte Funktion, um einen Pfad einfacher zu erzeugen */
        var line_func = d3.svg.line()
                            .x(function(d) { return d.x; })
                            .y(function(d) { return d.y; })
                            /* 'cardinal' versucht den Pfad über die Punkte verlaufen zu lassen und schließt den Pfad am Ende */ 
                            .interpolate("cardinal");
        
        /* Attrbutwert für 'd' zurückgeben */
        return line_func(line_data);
    };

    
    
    /* Jahrestexte innerhalb einer SVG-Gruppe erzeugen (justify) */
    var create_year_text_in_group = function(group_node, year_start, year_amount, max_width) {
        
        /* Abstand zwischen den Textelementen (enthalten Jahreszahl) bestimmen */
        var width_step = max_width / year_amount;
        
        /* Für jede Jahreszahl ein Textelement erzeugen und es dem g-Element anhängen */
        for(var i = 0; i < year_amount; i++) {
            group_node.append("text")
                .attr("pointer-events", "none")
                .attr("x", function() { return width_step * i - 15; })
                .attr("y", 20)
                .attr("style", "font-size: 0.8em;")
                .attr('text-anchor', 'middle')
                .html("" + year_start);
            
            /* Das Jahr erhöhen */
            year_start++;
        }
    };
    
    
    
    /* Ausgelagerte Initialisierungs-Prozedur */
    function initGraph() {
        
        vizsvg = document.querySelector('#graph_viz');
        
        var vis = d3.select(vizsvg);
        
        /* 
         *  Alle Nodes und Links in ein übergeordnetes Gruppenelement ("g") gruppieren,
         *      damit man das Gruppenelement und ihre entahltenen Elemente besser bewegen kann -> hilfreich für Panning
         */
        var g_all = vis.append('g').attr('class', 'grouper');
        
        /* Hilfsvariablen, um die momentane Verschiebung des übergeordneten Gruppenelements festzuhalten */
        var start_curr_g_pos = [0, 0];
        var curr_g_pos = [];
        var body_jq_node = $('body');
        
        /* Panning ohne direkte Unterstützung von d3.js umgesetzt, da es zuerst bei einigen Tests Probleme gab */
        vis.on('mousedown', function() {
            /* Nur wenn das "svg"-Element angeklickt wurde, soll das Panning möglich sein */
            if(d3.event.target != vizsvg)
                return;
            
            /* Momentane Startposition für spätere Berechnungen zwischenspeichern */
            var start_pos = d3.mouse(vizsvg);
            var new_pos = [];
            
            /* Erst wen man auf das "svg"-Element geklickt hat, soll diesem der entsprechende Move-Handler zugewiesen werden */
            vis.on('mousemove', function() {
                /* 
                 *  Sofern man die Maus mit gedrückter Taste aus dem Fenster bewegt, bleibt das Panning beim Wiedereintritt aktiv;
                 *      der folgende Code überprüft bei jeder Mausbewegung, ob die Maustaste noch gedrückt wird und bricht das Panning ab,
                 *      wenn es nicht mehr so ist
                 */
                if(d3.event.buttons === 0) {
                    vis.on('mousemove', null);
                    start_curr_g_pos = curr_g_pos;
                    return;
                }
                
                /* Die aktuelle Mausposition beziehen, nachdem sie bewegt wurde */
                var curr_pos = d3.mouse(vizsvg);
                
                /* Positions-Differenz bilden */
                new_pos = [curr_pos[0] - start_pos[0], curr_pos[1] - start_pos[1]];
                
                /* Sofern die übergeordnete schon einmal in ihrere Position bewegt wurde, soll die letzte Verschiebung mitberücksichtigt werden */
                new_pos[0] += start_curr_g_pos[0];
                new_pos[1] += start_curr_g_pos[1];
                
                /* Eigentliche Positionierung */
                g_all.attr("transform", "translate(" + new_pos + ")");
                
                /* Die Hintergrundgrafik soll sich mitbewegen -> CSS-Wert "no-repeat"" darf für die Hintergrundgrafik nicht gesetzt sein */
                body_jq_node.css('background-position', new_pos[0] + "px " + new_pos[1] + "px");
                
                /* Aktuelle Position für das nächsten Mal, wenn "mousemove" getriggert wird, aufbewahren  */
                curr_g_pos = new_pos;
            })
        })
        .on('mouseup', function() {
            /*
             *  Wird die Maustaste losgelassen, soll das Panning ebenfalls nicht mehr mögloch sein -> Entfernen des "mousemove"-Handlers,
             *      und Sicherung der aktuellen Verschiebung für den nächsten Panning-Versuch
             */
            vis.on('mousemove', null);
            start_curr_g_pos = curr_g_pos;
        });
        
        
        /* Aktuelle Größe des Fensters festhalten */
        var height = $(window).height(),
            width = $(window).width();
        
        vizsvg.setAttribute("viewBox", "" + [0, 0, width, height]);
        vizsvg.setAttribute("preserveAspectRatio", "xMinYMin meet");
        
        /* Die Größe des im DOM befindlichen SVG-Elements */
        vizsvg.style.height = height + "px";
        vizsvg.style.width = width + "px";
        

        /* D3.js-Layout festlegen (Graph) und benötigte Startwerte angeben (nodes, links etc.) */
        force = d3.layout.force()
        .nodes(graph.nodes)
        .links(graph.links)
        .charge(-100)
        .gravity(0.01)
        .linkStrength(0.1)
        .linkDistance(function(link) {
            
            /* Die Kantenlänge anhand der Gewichtung festlegen */
            return 200 * (link.weight);
        })
        .size([width,height])
        .start();
        
        
        /*
         *  Wenn das Fenster in seiner Größe verändert wird,
         *      soll auch das Ausgabe-Element und das d3.js-Layout die neue Größe übernehmen
         */
        $(window).resize(function() {
            
            var height = $(window).height(),
                width = $(window).width();
            
            vizsvg.setAttribute("viewBox", "" + [0, 0, width, height]);
            
            force.size([width, height]);
            vizsvg.style.height = height + "px";
            vizsvg.style.width = width + "px";
        });
        
        
        /* Lines erzeugen (SVG-Line) und an diese jeweils ihre Daten binden */
        var link = g_all.selectAll(".link")
            .data(graph.links)
            .enter().append("line")
            .attr("class", "link")
            .style("stroke-width", 1)
            .style("stroke", function(d) {
                return "rgb(255, 255, 255)";
            });
        
        
        /*
         *  Nodes erzeugen (SVG-G) und an diese jeweils ihre Daten binden
         *      Als Node wird ein SVG-Group-Element gewählt,
         *          um zusammengehörige Elemente (Texte etc.) zu gruppieren
         */
        var node = g_all.selectAll(".node")
            .data(graph.nodes)
            .enter().append('g')
            .attr("class", "node");
            
            /*
             *  Visuell wird der Node als Rechteck mit abgerundeten Ecken dargestellt
             *      bzw. sieht er im Minimierten Zustand wie ein Kreis aus
             */
            node.append("rect")
            .attr("class", "topic")
            .attr("width", 30)
            .attr("height", 30)
            .attr("rx", 15)
            .attr("ry", 15)
            .attr("x", -15)
            .attr("y", -15)
            .style({
                "stroke": "rgba(255, 255, 255, 0.4)",
                "stroke-width": 2,
                "fill": function(d, i) {
                    var rgb =  hsl2rgb((1 - d.num_overall_mentioned/max_num_mentioned) * 130, 0.55, 0.71); /* Sättigung und Helligkeit niedrig */
                    return "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")";
                }
            })
            .on('dblclick', function(d, i) { /* Ein Doppelklick auf ein Node (Rechteck) soll das Rechteck Maximieren */
                
                d3.event.stopPropagation();
                
                /* Bei fehlendem Topic-Namen, macht es keinen Sinn diesen zu Maximieren */
                if(d.topic) {
                    
                    /*
                     *  Node kann visuell unterhalb eines anderen Nodes liegen,
                     *      weshalb dieser in den Vordergrund platziert werden muss
                     *          (SVG-Elemente kennen kein "z-index"-Attribut)
                     */
                    var rect = d3.select(this);
                    var g_jq = $($(this).parent()).detach();
                    $(g_all.node()).append(g_jq);
                    
                    /* Element-Referenzen für den späteren Gebrauch holen */
                    var top_text = $(this).parent().find("text");
                    var g_d3 = d3.select($(this).parent()[0]);
                    
                    if(d.open) {
                        /* Node ist im offen Zustand bzw. maximiert */
                        
                        /* In den Element-Daten festhalten, dass der Node nun geschlossen ist bzw. wird */
                        d.open = false;
                        
                        /* Zentrierter Topic-Name einblenden */
                        top_text.fadeIn();
                        $(this)
                            .parent()
                            .find(".main_content")
                            .fadeOut(function() {
                            
                                /* foreignObjects aus Gründen der Performance aus dem DOM-Baum entfernen */
                                $(this).parent().find("foreignObject").remove();
                            });
                        rect.transition()
                            .attr("width", d.size)
                            .attr("height", d.size)
                            .attr("rx", d.size/2)
                            .attr("ry", d.size/2)
                            .attr("x", -d.size/2)
                            .attr("y", -d.size/2)
                            .style("stroke-width", 2);
                        
                        force.charge(-100);
                        force.start();
                        
                        /* Den Abstract-Popup ebenfalls schließen, wenn der Node geschlossen/minimiert wird */
                        abstract_text_popup.stop().fadeOut();
                    }
                    else {
                        /* Node ist im geschlossenen Zustand bzw. minimiert */
                        
                        /* In den Element-Daten festhalten, dass der Node nun offen ist bzw. geöffnet wird */
                        d.open = true;
                        
                        /*
                         *  ForeignObject für die Frontdarstellung eines Topics einfügen, um eingebettete XHTML-Elemente zu ermöglichen,
                         *      da SVG keine Elemente anbietet, die Word-Wrapping unterstützen
                         */
                        addForeignObjectMain(g_d3);
                        addForeignObjectExpansion(g_d3);
                        
                        /* Zentrierter Topic-Name ausblenden */
                        top_text.fadeOut();
                        
                        /* Zuvor eingefügtes ForeignObject-Element (Vorderseite) einblenden */
                        $(this).parent().find(".main_content").fadeIn();
                        
                        /* Maximierungs-Transition (Animation) starten */
                        rect.transition()
                            .attr("width", 320)
                            .attr("height", 320)
                            .attr("rx", 40)
                            .attr("ry", 40)
                            .attr("x", -160)
                            .attr("y", -160)
                            .style("stroke-width", 7);
                        
                        /*
                         *  Geöffneter Node soll im Force-Layout auf andere Nodes einwirken (umso größer, desto abstoßender)
                         *      Es werden nur geöffnete Nodes betrachtet
                         */
                        force.charge(function(d) {
                            return (d.open) ? -700: -100;
                        });
                        
                        /* Das Layout mit den neuen Werten starten */
                        force.start();
                    }
                
                }
            })
            .on('mousedown', function() {
                //d3.event.stopPropagation();
            })
            .on('mousemove', function() {
                //d3.event.stopPropagation();
            })
            .on('mouseup', function() {
                //d3.event.stopPropagation();
            });

            /* Dem Gruppenelement ein zentriertes Textelement mit dem Topic-Namen hinzufügen */
            node.append('text')
            .attr("fill", "rgb(255, 255, 255)")
            .attr("pointer-events", "none")
            .attr("y", 5)
            .html(function(d, i) {
                return d.topic; /* Topic-Name als Inhalt des Text-Elements setzen */
            }).attr("text-anchor", function(d) {
                
                /*
                 *  Das Rechteck (minimiert als Kreis dargestellt) soll möglichst groß genug sein,
                 *      um den Text komplett in diesen zentrieren zu können
                 */
                var size = this.getBBox().width + 20;
                var rect = $(this).parent().find("rect");
                rect.attr("width", size);
                rect.attr("height", size);
                
                var size_h = size/2;
                
                rect.attr("rx", size_h);
                rect.attr("ry", size_h);
                rect.attr("x", -size_h);
                rect.attr("y", -size_h);
                
                /* Minimale Nodegröße für den späteren Gebrauch sichern (für spätere Minimierung) */
                d.size = size;
                
                /* Eigentlicher Wert für das "text-anchor"-Attribut (innerhalb des Gruppenelements zentrieren) */
                return "middle";
            });
            
            /* Jedes Node soll gezogen und verschoben werden können */
            node.call(force.drag);
            
            
        /*
         *  Nach jeder Neuberechnung der Position des Graphs und seiner Elemente,
         *      sollen die Nodes und Kanten, entsprechend ihrer neu berechneten Position, neu respositioniert werden
         *          (von D3.js vorgegebener Zeitpunkt; Tick)
         */
        force.on("tick", function() {
            link.attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });
            
            node.attr("transform", function(d, i) {
                return "translate(" + d.x + ", " + d.y + ")";
            });
        });
        
        
        /*
         *  Hinzufügen eines foreignObject-Elements, welcher es erlaubt innerhalb des SVG-Namespaces
         *      (X)HTML-Elemente einzubetten (ermöglicht die Nutzung von Elementen mit Word-Wrap-Eigenschaften);
         *  Inhalt der Vorderseite eines Topics
         */
        function addForeignObjectMain(node) {
        
            var content = node
                .append("foreignObject")
                .attr("class", "main_content")
                .attr("style", "display: none; margin-left: -150px; margin-top: -150px; cursor: default;")
                .attr("requiredExtensions", "http://www.w3.org/1999/xhtml")
                .attr("width", "300px")
                .attr("height", "300px")
                .attr("x", "-150px")
                .attr("y", "-150px")
                .on("dblclick", function(d, i) {
                
                    /*
                     *  Da der Node vom foreignObject komplett überdeckt wird,
                     *      kann auf diesem kein Doppelklick ausgeübt werden
                     *
                     *  Ein Doppelklick auf das foreignObject muss somit dem daunter liegenden 
                     *      Node gereicht werden. Dies wird durch ein simulierten Doppelklick auf das Rechteck-Element realisiert
                     */
                    var e = document.createEvent('UIEvents');
                    e.initUIEvent(  "dblclick", true, true,
                                    window, 0, 0, 0, 0, 0,
                                    false, false, false, false,
                                    0, null);
                
                    $(this).parent().find("rect")[0].dispatchEvent(e);
                });
            
            /* Übergeordnetes body-Element einfügen */
            var embed_div = content.append("xhtml:body")
                .attr("xmlns", "http://www.w3.org/1999/xhtml")
                .style("background", "transparent");
        

            /* Dem body-Element wird ein Header-Element hinzugefügt */
            embed_div.append("h2")
                .attr("class", "topic_name")
                .text(function(d, i) { return d.topic });
            
            
            /*
             *  Ist der Abstact zu lang für den Node, wird er gekürzt dargestellt
             *
             *  Über ein zusätzlich angehängtes Auslassungszeichen ([...]), wird der restliche 
             *      Abstract in einem Popup angezeigt
             *
             *  Ist der Abstract kurz genug, wird kein Auslassungszeichen angehangen
             */
            
            /*
             *  Im späteren Verlauf kann die Variable "full_abstract_popup_text" je nach Abstract-Länge,
             *      ein Span-Element für das Auslassungszeichen enthalten
             */
            var full_abstract_popup_text = null;
            
            /* Div-Element für den Abstract erzeugen und einfügen */
            var abstract_text_div = embed_div.append("div")
                .attr("class", "abstract_text")
                .html(function(d, i) {
                    
                    /*
                     *  Ein verkürzter Abstact soll maximal 360 Zeichen besitzen,
                     *      bzw. etwas mehr, wenn kurz nach dem 360.ten Zeichen ein Leerzeichen existiert
                     */
                    var i = 360;
                    while(i < d.abstract.length && d.abstract[i] != ' ') {
                        i++;
                    }
                    
                    /* "Schnittposition" für den späteren Gebrauch sichern */
                    d.abstract_pos = i;
                    
                    /* Den restlichen Abstract-Text extrahieren */
                    var abstract_rest = d.abstract.slice(d.abstract_pos);
                    
                    /*
                     *  Ist der restliche Abstract-Text größer als 0 Zeichen,
                     *      wird ein Auslassungs-Kennzeichen hinzugefügt
                     */
                    if(abstract_rest.length > 0) {
                    
                        /* Das neue Span-Element wird der "full_abstract_popup_text"-Variable zugewiesen */
                        full_abstract_popup_text = $("<span>")
                        .html("[...]")
                        .hover(function(e) { /* MouseEnter */
                            
                            if(!d.open)
                                return;
                            
                            /* Popup mit dem restlichen Abstract-Text befüllen und danach direkt einblenden */
                            abstract_text_popup
                                .html(abstract_rest)
                                .css({  'left': (e.pageX + 10) + "px",
                                        'top': (e.pageY + 10) + "px"})
                                .stop()
                                .fadeIn();
                        },
                        function(e) { /* MouseLeave */
                            
                            /*
                             *  Beim verlassen des Auslassungszeichen-Elements mit der Maus,
                             *      soll der Popup ausgeblendet werden
                             */
                            abstract_text_popup
                                .stop()
                                .fadeOut();
                        });
                    }
                    
                    /* Den verkürzten Abstract für die Darstellung zurückgeben */
                    return d.abstract.slice(0, i) + " ";
                });
            
            /*
             *  Existiert ein restlicher Abstract, wurde auch ein Span-Element erzeugt
             *      und der Variable "full_abstract_popup_text" zugewiesen
             *    
             *  Das Span-Element, mit dem verkürzten Abstract, kann somit dem Div-Element angehangen werden,
             *      um den Popup mit dem restlichen Abstract aufrufen zu können
             */
            if(full_abstract_popup_text != null) {
                $(abstract_text_div.node()).append(full_abstract_popup_text);
            }
            
            
            /*
             *  Hinzufügen eines Div-Elements, um Dateien aufzulisten,
             *      die mit dem Topic in Beziehung stehen
             */
            var turn_over_placer = embed_div.append("div")
                .attr("class", "turn_over_placer");
            

            var turn_over_btn = turn_over_placer.append("a")
                .attr("class", "turn_over_btn")
                .attr("href", "javascript:void(0);");
            
            var turn_over_btn_jq = $(turn_over_btn.node());
            
            turn_over_btn_jq.html('Erweitert');
            
            turn_over_btn_jq.on('click', function(e) {
                
                var rect = d3.select($(node.node()).find('rect')[0]);
                
                /* Haupt-ForeignObject ausblenden */
                $(content.node()).stop().fadeOut();
                
                /* Wende-Transition (Animation) starten  -> von der Vorder- zur Rückseite */
                rect.transition()
                    .duration(700)
                    .attr("width", 0)
                    .attr("rx", 40)
                    .attr("ry", 40)
                    .attr("x", 0)
                    .each('end', function() {
                        rect.transition()
                            .duration(700)
                            .attr("width", 640)
                            .attr("height", 560)
                            .attr("rx", 40)
                            .attr("ry", 40)
                            .attr("x", -320)
                            .attr("y", -280)
                            .each('end', function() {
                                /* Erweiterungs-ForeignObject einblenden */
                                var forgObj = $(node.node()).find(".expanded_content").fadeIn();
                                /* Nano-Scrollbar für die zusätzlichen Topic-Infos einbinden */
                                forgObj.find(".nano").nanoScroller({ flash: true });
                            });
                    });
            });
            
        }
        
        
        
        /*
         *  Hinzufügen eines foreignObject-Elements, welcher es erlaubt innerhalb des SVG-Namespaces
         *      (X)HTML-Elemente einzubetten (ermöglicht die Nutzung von Elementen mit Word-Wrap-Eigenschaften);
         *  Inhalt der Rückseite eines Topics
         */
        function addForeignObjectExpansion(node) {
            var content = node
                .append("foreignObject")
                .attr("class", "expanded_content")
                .attr("style", "display: none; margin-left: -320px; margin-top: -320px; cursor: default;")
                .attr("requiredExtensions", "http://www.w3.org/1999/xhtml")
                .attr("width", "640px")
                .attr("height", "560px")
                .attr("x", "-320px")
                .attr("y", "-280px")
                .on("dblclick", function(d, i) {
                
                    /*
                     *  Da der Node vom foreignObject komplett überdeckt wird,
                     *      kann auf diesem kein Doppelklick ausgeübt werden
                     *
                     *  Ein Doppelklick auf das foreignObject muss somit dem daunter liegenden 
                     *      Node gereicht werden. Dies wird durch ein simulierten Doppelklick auf das Rechteck-Element realisiert
                     */
                    var e = document.createEvent('UIEvents');
                    e.initUIEvent(  "dblclick", true, true,
                                    window, 0, 0, 0, 0, 0, 
                                    false, false, false, false,
                                    0, null);
                
                    $(this).parent().find("rect")[0].dispatchEvent(e);
                });
            
            /* Übergeordnetes body-Element einfügen */
            var embed_div = content.append("xhtml:body")
                .attr("xmlns", "http://www.w3.org/1999/xhtml")
                .style("background", "transparent");
        

            /* Dem body-Element wird ein Header-Element hinzugefügt */
            embed_div.append("h2")
                .attr("class", "topic_name")
                .text(function(d, i) { return d.topic });
            
            

            /* DIV-Container, in dem nur der für das Topic relevante Verlauf grafisch ausgegeben wird */                
            var frequency_single_diagram = embed_div.append("div")
                .attr("class", "frequency_single_diagram");
                
            
            /* Frequenz-Diagramm erzeugen */
            
            var topic_single_diagram = frequency_single_diagram.append("svg").attr("class", "topic_single_diagram");
            
            var data_arr = [];
            
            topic_single_diagram.append("g")
                .attr("class", "frequence_path")
                .attr("transform", "translate(30, 10)")
                .append("path")
                .attr("d", function(d, i) {
                    var freq_arr = d.frequency_per_year;
                    
                    data_arr = [];
                    for(var i = years_min_max.min; i <= years_min_max.max; i++) {
                        var val = freq_arr[''+i];
                        
                        if(typeof(val) === 'undefined')
                            val = 0;
                        
                        data_arr.push(val);
                    }
                    
                    return line_function(data_arr, 620, 50);
                })
                .attr("stroke-width", "0");
            
            
            var year_group = topic_single_diagram.append("g")
                .attr("class", "frequence_years")
                .attr("transform", "translate(45, 120)")
            
            create_year_text_in_group(year_group, years_min_max.min, data_arr.length, 620);
            
                
            /* DIV-Container, in dem weitere Infos ausgegeben werden */
            var topic_more_infos = embed_div.append("div")
                .attr("class", "topic_more_infos");
            
            /* Autoren-Liste */
            var authors_list = topic_more_infos.append("div")
                .attr("class", "authors_list");
            
            authors_list.append("span")
                        .text("Autoren");
                        
            var authors_content = authors_list.append("div")
                        .attr("class", "content_wrapper nano")
                            .append("div")
                                .attr("class", "content");
                                
                                
            var authors_arr = [];
            var mentioned_by_arr = node.data()[0].mentioned_by;
            
            if(typeof(mentioned_by_arr) !== 'undefined') {
                
                /* Die Namen aller Autoren heraussuchen, die das Topic erwähnt haben */
                for(var i = 0; i < mentioned_by_arr.length; i++) {
                    for(var j = 0; j < authors.length; j++) {
                        if(authors[j].id === mentioned_by_arr[i]) {
                            authors_arr.push(authors[j].name);
                        }
                    }
                }
                
            }
            
            /* Autoren-Liste füllen */
            var authors_ul = authors_content.append("ul").attr("class", "list");
            for(var i = 0; i < authors_arr.length; i++) {
                authors_ul.append("li").text(authors_arr[i]);
            }
            
            
            /* Dokumenten-Liste */
            var docs_list = topic_more_infos.append("div")
                .attr("class", "documents_list");
            docs_list.append("span")
                        .text("Dokumente");
            
            var docs_content = docs_list.append("div")
                        .attr("class", "content_wrapper nano")
                            .append("div")
                                .attr("class", "content");                
            
            // TODO: richtig verlinken
            var docs_arr = node.data()[0].files;
            
            /* Dokumenten-Liste füllen */
            var docs_ul = docs_content.append("ul").attr("class", "list");
            for(var i = 0; i < docs_arr.length; i++) {
                docs_ul.append("li").append("a").attr("target", "_blank").attr("href", "#" + docs_arr[i]).text(docs_arr[i]);
            }
            
            
            /* Links-Liste */
            var links_list = topic_more_infos.append("div")
                .attr("class", "links_list");
            
            links_list.append("span")
                        .text("Links");
            
            var links_content = links_list.append("div")
                        .attr("class", "content_wrapper nano")
                            .append("div")
                                .attr("class", "content");
            
             // TODO: austauschen
            var links_arr = [{"title": "Wikipedia", "href": "http://de.wikipedia.org/w/index.php?title=Spezial:Suche&search=" + node.data()[0].topic },
                             {"title": "DBPedia", "href": "http://dbpedia.org/resource/" + node.data()[0].topic} ];
            
            /* Links-Liste füllen */
            var links_ul = links_content.append("ul").attr("class", "list");
            for(var i = 0; i < links_arr.length; i++) {
                links_ul.append("li").append("a").attr("target", "_blank").attr("href", links_arr[i].href).text(links_arr[i].title);
            }
            
            
            
            /* Clearfix */
            topic_more_infos.append("div")
                .attr("class", "clear_fix");
            
            /*
             *  Hinzufügen eines Div-Elements, um Dateien aufzulisten,
             *      die mit dem Topic in Beziehung stehen
             */
            var turn_over_placer = embed_div.append("div")
                .attr("class", "turn_over_placer");
            

            var turn_over_btn = turn_over_placer.append("a")
                .attr("class", "turn_over_btn")
                .attr("href", "javascript:void(0);");
            
            var turn_over_btn_jq = $(turn_over_btn.node());
            
            turn_over_btn_jq.html('Simpel');
            
            turn_over_btn_jq.on('click', function() {
                var rect = d3.select($(node.node()).find('rect')[0]);
                
                /* Erweiterungs-ForeignObject ausblenden */
                var forObj = $(content.node()).stop().fadeOut();
                forObj.find(".nano").nanoScroller({ flash: true });
                
                /* Wende-Transition (Animation) starten -> von der Rück- zur Vorderseite */
                rect.transition()
                    .duration(700)
                    .attr("width", 0)
                    .attr("rx", 40)
                    .attr("ry", 40)
                    .attr("x", 0)
                    .each('end', function() {
                    
                        rect.transition()
                            .duration(700)
                            .attr("width", 320)
                            .attr("height", 320)
                            .attr("rx", 40)
                            .attr("ry", 40)
                            .attr("x", -160)
                            .attr("y", -160)
                            .each('end', function() {
                                /* Haupt-ForeignObject einblenden */
                                $(node.node()).parent().find(".main_content").fadeIn();
                            })
                    });
            });
        }
    }

    
    /* Handler usw. erst zuweisen, wenn der DOM-Baum komplett aufgebaut ist bzw. die Seite komplett geladen wurde */
    $(document).ready(function() {
        
        /* Referenz auf das im DOM existierende Popup-Element holen und für den späteren Gebrauch sichern */
        abstract_text_popup = $("#abstract_text_popup");
        
        /* Referenz auf das Overlay-Popup holen und für den späteren Gebrauch sichern */
        frequency_overlay = $("#frequency_overlay");
        $("#frequency_overlay_close_button").on("click", function() { toggle_frequency_overlay(); })
            .css("opacity", 0.4)
            .hover( function(e) { $(this).stop().animate({"opacity": 1.0}, 300); }, /* MouseEnter */
                    function(e) { $(this).stop().animate({"opacity": 0.4}, 200); }); /* MouseLeave */
        
        
        /* Click-Handler den Elementen innerhalb der Sidebar zuweisen */
        $("#frequency_diagramm_button").on('click', function() {
            toggle_frequency_overlay();
        });
        
        
        /* Ausglagerte Prozedur zur Diagrammerstellung (Zeitliche Entwicklung der Häufigkeit eines Terms) */
        function create_frequency_diagram() {
        
            /* Node-Referenz des DIV-Elements holen */
            frequencyvizsvg = document.querySelector('#frequency_viz');
            var frequencyvis = d3.select(frequencyvizsvg);

            var frequencyvizsvg_jq = $(frequencyvizsvg);

            /* Dimension des SVG-Elements setzen */
            frequencyvizsvg_jq.css("height", frequencyvizsvg_jq.height() + "px");
            frequencyvizsvg_jq.css("width", frequencyvizsvg_jq.width() + "px");
            
            /* Die für die Ausgabe relevanten Daten für d3.js holen bzw. Umbettungsstrukturen definieren */
            var nodes = graph.nodes;
            
            /* D3.js - Einbindung */
            var item_histories =
                frequencyvis.selectAll('.term_history')
                    .data(nodes)
                    .enter();
            
            /* Ausgabe des Terms bzw. Topics */
            var item_g = item_histories.append("g")
                .attr("transform", function(d, i) {
                    return "translate(0, " + (i * 110 + 10) + ")";
                });
                
            item_g.append("text")
                .attr("class", "item_title_text")
                .attr("pointer-events", "none")
                .attr("dx", "175px")
                .attr("y", function(d, i) {
                    return (55 + i * 30) + "px";
                })
                .html(function(d, i) {
                    return d.topic; /* Topic-Name als Inhalt des Text-Elements setzen */
                })
                .attr("text-anchor", "end");
            
            var data_arr = [];
            
            item_g.append("g")
                .attr("class", "frequence_path")
                .attr("transform", function(d, i) { return "translate(200, "+(i*30)+")"; })
                .append("path")
                .attr("d", function(d, i) {
                    
                    var freq_arr = d.frequency_per_year;
                    
                    data_arr = [];
                    for(var i = years_min_max.min; i <= years_min_max.max; i++) {
                        var val = freq_arr[''+i];
                        
                        if(typeof(val) === 'undefined')
                            val = 0;
                        
                        data_arr.push(val);
                    }
                    
                    return line_function(data_arr, 700, 50, frequency_min_max.max);
                })
                .attr("stroke-width", "0");
            
            var g_nodes = $(frequencyvis.node()).children();
            
            var new_height = null;
            
            $.each(g_nodes, function(i, d) {
                var g_year_node = $(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
                
                $(d).after(g_year_node);
                var g_node = d3.select(g_year_node[0]);
                
                var year_group = g_node
                    .attr("class", "frequence_years")
                    .attr("transform", function(d) {  new_height = 100 + (i*140); return "translate(215, " + new_height + ")"; });
                
                create_year_text_in_group(year_group, years_min_max.min, data_arr.length, 700);
            });
            
            frequency_viz.style.height = (new_height + 70) + "px";
        }
        
        
        /* Funktion zur Steuerung des Häufigkeits-Popups bzw. -Overlays */
        function toggle_frequency_overlay() {
            
            /* Sofern das Popup nicht offen ist */
            if(!frequency_overlay.is(':visible')) {
                /* Stoppe den Graphen im Hintergrund -> da nicht mehr im Fokus und zu dem Zeitpunkt irrelevant */
                if(force)
                    force.stop();
                
                /* Erzeuge das Häufigkeits-Diagramm */
                create_frequency_diagram();
                /* Popup bzw. Overlay einblenden */
                frequency_overlay.stop().fadeIn();
            
                /* Nano-Scrollbar initialisieren */
                $(".nano").nanoScroller({ flash: true });
            }
            /* Sofern das Popup offen ist */
            else {
                /* Blende das Popup bzw. Overlay aus und entleere den Inhalt des Diagramms (Elemente im SVG-Element) */
                frequency_overlay.stop().fadeOut(function() { $(frequencyvizsvg).empty(); });
                
                /* Starte die Positionsberechnung des Graphen, der nun wieder den Fokus besitzt */
                if(force)
                    force.start();
                    
                /* Nano-Scrollbar zerstören */
                $(".nano").nanoScroller({ stop: true });
            }
        }
        
        
        /*
         *  Export-Button, um das Diagramm innerhalb des Popups als Grafik zu exportieren
         */
        $("#frequency_export_button").on("click", function(e) {
            
            var svg_title = "Zeitliche Entwicklung der Topics";
            
            var svg_elem = $("#frequency_viz")
                .attr({
                    "version": "1.1",
                    "xmlns": "http://www.w3.org/2000/svg"
                }).prepend("<title>" + svg_title + "</title>" +
                            "<defs>\n" +
                            "<style type=\"text/css\" >\n" +
                                "<![CDATA[\n" +
                                    "@font-face {" +
                                        "font-family: 'Lato';\n" +
                                        "font-style: normal;\n" +
                                        "font-weight: 400;\n" +
                                        "src: local('Lato Regular'), local('Lato-Regular'), url(./font/lato_regular.woff) format('woff');" + // TODO: Evtl. die Schriftart per base64 einbetten
                                    "}\n" +
                                    
                                    "* {\n" +
                                         "font-family: Lato, Helvetica, Arial, Verdana, sans-serif;\n" +
                                    "}\n" +
                                    
                                    "frequence_path {\n" +
                                         "fill: black;\n" +
                                    "}\n" +
                                    
                                    
                                "]]>\n" + 
                            "</style>\n" +
                            "</defs>");
            
            var svg_html = svg_elem.parent().html();
            
            window.open("data:image/svg+xml;base64,"+ btoa(svg_html), 'Diagramm der Topic-Entwicklung');
        });
        
    })

})(this.jQuery)
