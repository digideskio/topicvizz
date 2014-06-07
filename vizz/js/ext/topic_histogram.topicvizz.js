
(function($, window) {

    /* Informationen über die Extension */
    var ext_info = {
        name:       'topic_histogram',
        shortname:  'histo',
        id:         'histogram_overlay'
    };

    var is_open = false;

    var m_node              = null;
    var m_svg_node          = null;
    var m_defs_node         = null;
    var m_data              = null;
    var m_graph_data        = null;
    var m_helper_functions  = null;

    var m_callbacks = {
        onShow: $.noop,
        onHide: $.noop
    };
    

    /* Hilfsvariablen, um das kleineste und größte Jahr sowie den kleinsten
     *  und größten Häufigkeitswert feestzuhalten
     */
    var m_years_min_max = null;
    var m_histogram_min_max = null;


    var ext = {
        /* ### INFO ### */ 
        info: ext_info,
        
        eval_topic: function(topic) {
            
        },
        
        /* ### INIT ### - Funktion die von TopicVizz zur Initialisierungsphase aufgerufen wird */
        init: function(node, data, graph_data, callbacks, helper_functions) {
            
            m_node              = node;
            m_data              = data;
            m_graph_data        = graph_data;
            m_helper_functions  = helper_functions;
            
            m_years_min_max     = graph_data.years_min_max;
            m_histogram_min_max = graph_data.histogram_min_max;
            
            if(callbacks && callbacks.onShow && callbacks.onHide)
                m_callbacks = callbacks;
            
            node.attr('id', ext_info.id);
            
            var heading = $('<h2>').html('Zeitliche Entwicklung der Termhäufigkeit');
            node.append(heading);
            
            var close_button = $('<div>').addClass('overlay_close_button');
            close_button.on('click', function() {
                ext.hide();
            });
            node.append(close_button);
                        
            var content_wrapper = $('<div>').addClass('content_wrapper')
                                            .addClass('nano');

                var content = $('<div>').addClass('content');
                    
                    var svg = $(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
                    svg.attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
                        
                        m_defs_node = $(document.createElementNS('http://www.w3.org/2000/svg', 'defs'));
                        svg.prepend(m_defs_node);
                    
                    content.append(svg);
                    m_svg_node = svg;
                    
                content_wrapper.append(content);

            node.append(content_wrapper);


            var sub_bar = $('<div>').addClass('sub_bar');
            
                var input_btn = $('<input>').attr('type', 'button')
                                            .attr('id', 'histogram_export_button')
                                            .val('Als Grafik exportieren...');
                    
                /*
                 *  Export-Button, um das Diagramm innerhalb des Popups als Grafik zu exportieren
                 */
                input_btn.on("click", function(e) {
                    
                    var svg_title = "Zeitliche Entwicklung der Topics";
                    
                    var svg_elem = m_svg_node.clone()
                        .attr({
                            "version": "1.1",
                            "xmlns": "http://www.w3.org/2000/svg"
                        }).prepend("<title>" + svg_title + "</title>");
                        
                    svg_elem.find('defs')
                            .append("\n<style type=\"text/css\" >\n" +
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
                                            
                                            "histogram_path {\n" +
                                                 "fill: black;\n" +
                                            "}\n" +
                                            
                                            
                                        "]]>\n" + 
                                    "</style>\n");
                    
                    svg_elem.find('defs .histogram_years').attr('id', 'def_histogram_years');

                    /* Alle doppelten g-Elemente mit den Jahrestexten durch use-Elemente ersetzen,
                     *  die alle auf ein g-Element innerhalb des defs-Blocks verweisen (Referenz).
                     *      Dies führt zu einer kleineren SVG-Grafikdatei. */
                    $.each(svg_elem.find('.histogram_years').not('defs .histogram_years'), function(i, g_node) {
                        var g_node = $(g_node);
                        var use_node = $(document.createElementNS('http://www.w3.org/2000/svg', 'use'));
                        use_node.attr("xlink:href", "#def_histogram_years");
                        use_node.attr('transform', g_node.attr('transform'));
                        
                        g_node.replaceWith(use_node);
                    });
                    
                    var wrapper_parent = $('<div>').append(svg_elem);
                    var svg_html = "<?xml version=\"1.0\" encoding=\"utf-8\" ?>\n" + 
                                   "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">" +
                                   wrapper_parent.html();
                    
                    window.open("data:image/svg+xml;base64,"+ btoa(unescape(encodeURIComponent(svg_html))), 'Diagramm der Topic-Entwicklung');
                });
                
                sub_bar.append(input_btn);
                
            node.append(sub_bar);
        },
        
        /* ### SHOW ### - */
        show: function() {
            
            is_open = true;
            
            /* Auflistung wurde bereits erzeugt */
            if(m_svg_node.children().not('defs').length === 0) {
            
                var histogramvizsvg_jq = m_svg_node;
                
                /* Node-Referenz des DIV-Elements holen */
                histogramvizsvg = histogramvizsvg_jq.get(0);
                
                var histogramvis = d3.select(histogramvizsvg);

                /* Die für die Ausgabe relevanten Daten für d3.js holen bzw. Umbettungsstrukturen definieren */
                var nodes = m_graph_data.nodes;
                
                /* D3.js - Einbindung */
                var item_histories =
                    histogramvis.selectAll('.term_history')
                        .data(nodes)
                        .enter();
                
                /* Ausgabe des Terms bzw. Topics */
                var item_g = item_histories.append("g")
                    .attr("transform", function(d, i) {
                        return "translate(0, " + (i * 110 + 30) + ")";
                    });
                    
                var data_arr = [];
                
                /* Gruppe für den Histogrammpfad erzeugen */
                item_g.append("g")
                    .attr("class", "histogram_path")
                    .attr("transform", function(d, i) { return "translate(100, "+(i * 30 + 10)+")"; })
                    .append("path")
                    .attr("d", function(d, i) {
                        
                        var histogram_arr = d.frequency_per_year;
                        
                        /* Jahresdaten für die Generierung des Histogrammpfads */
                        data_arr = [];
                        for(var i = m_years_min_max.min; i <= m_years_min_max.max; i++) {
                            var val = histogram_arr[''+i];
                            
                            if(typeof(val) === 'undefined')
                                val = 0;
                            
                            data_arr.push(val);
                        }
                        
                        return m_helper_functions.line_function(data_arr, 850, 50, m_histogram_min_max.max);
                    })
                    .attr("stroke-width", "0");
                
                var g_nodes = $(histogramvis.node()).children();
                
                var new_height = 0;
                
                /* SVG-Element  */
                var g_year_node = $(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
                var g_node = d3.select(g_year_node[0]);
                g_node.attr("class", "histogram_years");
                
                /* Achsenbeschriftung (x-Achse) innerhalb des gegebenen Gruppen-ELement erzeugen lassen */
                m_helper_functions.create_year_text_in_group(g_node, m_years_min_max.min, data_arr.length, 850);
                
                /* Festhalten der Achsenbeschriftung innerhalb des defs-Blocks des SVG-Elements;
                 *  wird für den späteren Export der Grafik benötigt, um die Dateigröße klein zu halten,
                 *      indem alle Achsenbeschriftungen per use-Element darauf referenzieren */
                m_defs_node.append(g_year_node);
                
                /* Achsenbeschriftung nicht immer neu generieren lassen,
                 *  sondern die bestehende klonen und den Klon einfügen */
                $.each(g_nodes, function(i, d) {
                    var g_node_clone = g_year_node.clone();
                    g_node_clone.attr("transform", function(d) {
                        new_height = 130 + ( i * + 140);
                        return "translate(115, " + new_height + ")";
                    });
                    
                    $(d).after(g_node_clone);
                });
                
                item_g.append("text")
                    .attr("class", "item_title_text")
                    .attr("pointer-events", "none")
                    .attr("dx", "20px")
                    .attr("y", function(d, i) {
                        return (10 + i * 30) + "px";
                    })
                    .html(function(d, i) {
                        /* Topic-Name als Inhalt des Text-Elements setzen */
                        return d.topic;
                    });
                
                
                histogramvizsvg_jq.css('height', (new_height + 70) + "px");
            }
            
            /* Finales Einblenden */
            m_node && m_node.stop().fadeIn();
            
            /* Nano-Scrollbar initialisieren */
            m_node.find(".nano").nanoScroller({ flash: true });
            
            m_callbacks.onShow();
        },
        
        /* ### HIDE ### - Funktion die bei jedem Verstecken aufgerufen wird (Overlay-Wechsel etc.) */
        hide: function() {
            
            m_callbacks.onHide();
            
            /* Popup bzw. Overlay ausblenden */
            m_node && m_node.stop().fadeOut(function() { m_svg_node.empty(); });
            
            /* Nano-Scrollbar zerstören */
            m_node.find(".nano").nanoScroller({ stop: true });
            
            is_open = false;
        },
        
        /* ### IS_OPEN ### */
        is_open: function() {
            return is_open;
        }
    };

    /* Prüfen ob TopicVizz eingebunden ist und die Extension hinzugefügt werden kann */
    (       TopicVizz
        &&  TopicVizz.bindExtension
        &&  TopicVizz.bindExtension(ext) );

}(this.jQuery, window));
