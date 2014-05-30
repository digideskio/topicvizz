
(function($, window) {

    /* Informationen über die Extension */
    var ext_info = {
        name:       'topic_frequency',
        shortname:  'freq',
        id:         'frequency_overlay'
    };

    var is_open = false;

    var m_node              = null;
    var m_svg_node          = null;
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
    var m_frequency_min_max = null;


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
            m_frequency_min_max = graph_data.frequency_min_max;
            
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
                    content.append(svg);
                    m_svg_node = svg;
                    
                content_wrapper.append(content);

            node.append(content_wrapper);


            var sub_bar = $('<div>').addClass('sub_bar');
            
                var input_btn = $('<input>').attr('type', 'button')
                                            .attr('id', 'frequency_export_button')
                                            .val('Als Grafik exportieren...');
                    
                /*
                 *  Export-Button, um das Diagramm innerhalb des Popups als Grafik zu exportieren
                 */
                input_btn.on("click", function(e) {
                    
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
                
                sub_bar.append(input_btn);
                
            node.append(sub_bar);
        },
        
        /* ### SHOW ### - */
        show: function() {
            
            is_open = true;
            
            /* Auflistung wurde bereits erzeugt */
            if(m_svg_node.children().length === 0) {
            
                var frequencyvizsvg_jq = m_svg_node;
                
                /* Dimension des SVG-Elements setzen */
                frequencyvizsvg_jq.css("height", frequencyvizsvg_jq.height() + "px");
                frequencyvizsvg_jq.css("width", frequencyvizsvg_jq.width() + "px");
                
                /* Node-Referenz des DIV-Elements holen */
                frequencyvizsvg = frequencyvizsvg_jq.get(0);
                
                var frequencyvis = d3.select(frequencyvizsvg);

                /* Die für die Ausgabe relevanten Daten für d3.js holen bzw. Umbettungsstrukturen definieren */
                var nodes = m_graph_data.nodes;
                
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
                    .attr("transform", function(d, i) { return "translate(250, "+(i*30)+")"; })
                    .append("path")
                    .attr("d", function(d, i) {
                        
                        var freq_arr = d.frequency_per_year;
                        
                        data_arr = [];
                        for(var i = m_years_min_max.min; i <= m_years_min_max.max; i++) {
                            var val = freq_arr[''+i];
                            
                            if(typeof(val) === 'undefined')
                                val = 0;
                            
                            data_arr.push(val);
                        }
                        
                        return m_helper_functions.line_function(data_arr, 700, 50, m_frequency_min_max.max);
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
                    
                    m_helper_functions.create_year_text_in_group(year_group, m_years_min_max.min, data_arr.length, 700);
                });
                
                frequencyvizsvg_jq.css('height', (new_height + 70) + "px");
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
