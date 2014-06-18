
(function($, window) {
    "use strict";

    /* Informationen über die Extension */
    var ext_info = {
        name:       'topic_histogram',
        shortname:  'histo',
        id:         'histogram_overlay'
    };

    var is_open = false;

    var m_node                  = null;
    var m_svg_node              = null;
    var m_defs_node             = null;
    var m_data                  = null;
    var m_graph_data            = null;
    var m_helper                = null;
    var m_content_wrapper_node  = null;
    var m_content_node          = null;
    var m_inspector_area        = null;
    var m_insp_topics_list      = null;
    var m_insp_topics_diag      = null;

    var m_callbacks = {
        onShow: $.noop,
        onHide: $.noop
    };
    

    /* Hilfsvariablen, um das kleineste und größte Jahr sowie den kleinsten
     *  und größten Häufigkeitswert festzuhalten
     */
    var m_years_min_max     = null;
    var m_histogram_min_max = null;


    var ext = {
        /* ### INFO ### */ 
        info: ext_info,
        
        eval_topic: function(topic) {
            
        },
        
        /* ### INIT ### - Funktion die von TopicVizz zur Initialisierungsphase aufgerufen wird */
        init: function(node, data, graph_data, callbacks, helper) {
            
            m_node          = node;
            m_data          = data;
            m_graph_data    = graph_data;
            m_helper        = helper;
            
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
                        
            m_content_wrapper_node = $('<div>').addClass('content_wrapper')
                                            .addClass('nano');

                m_content_node = $('<div>').addClass('content');
                    
                    var svg = $(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
                    svg.attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
                        
                        m_defs_node = $(document.createElementNS('http://www.w3.org/2000/svg', 'defs'));
                        svg.prepend(m_defs_node);
                    
                    m_content_node.append(svg);
                    m_svg_node = svg;
                    
                                     
                    m_content_node.on('scroll', function(e) {
                        if(m_content_node.data('timeoutHandler'))
                            window.clearTimeout(m_content_node.data('timeoutHandler'));
                        
                        m_content_node.addClass('scrolling');
                        
                        var timeoutHandler = window.setTimeout(function() {
                            m_content_node.removeClass('scrolling').data('timeoutHandler', null);
                        }, 200);
                        
                        m_content_node.data('timeoutHandler', timeoutHandler);
                    });
                
                m_content_wrapper_node.append(m_content_node);

            node.append(m_content_wrapper_node);
            
            /* Bereich für die Übereinanderlegung von Diagrammen; höchstens fünf Topics */
            m_inspector_area = $('<div>').addClass('inspector_area');
            m_inspector_area.hide();
            
                m_insp_topics_list = $('<ul>').addClass('insp_topic_list');
                
                var topic_list_wrapper = $('<div>').css({width: '200px', float: 'left'});
                topic_list_wrapper.append(m_insp_topics_list);
                
                m_inspector_area.append(topic_list_wrapper);
                
                var svg_elem = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                m_insp_topics_diag = $(svg_elem).attr('class', 'inspector_histogram_holder');
                m_insp_topics_diag.attr({width: '700px', height: '170px'});
                
                var topic_diagram_con = $('<div>').css({width: '700px', float: 'right'});
                topic_diagram_con.append(m_insp_topics_diag);
                
                m_inspector_area.append(topic_diagram_con);
                
                m_inspector_area.append($('<div>').css('clear', 'both'));
            
            node.append(m_inspector_area);
            

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
                var histogramvizsvg = histogramvizsvg_jq.get(0);
                
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
                    .attr("transform", function(d, i) { return "translate(120, " + ((i + 1) * 30) + ")"; })
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
                        
                        return m_helper.line_function(data_arr, 850, 50, m_histogram_min_max.max);
                    })
                    .attr("stroke-width", 0);
                
                
                var g_nodes = $(histogramvis.node()).children().not('defs');
                
                var new_height = 0;
                
                /* SVG-Element  */
                var g_year_node = $(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
                var g_node = d3.select(g_year_node[0]);
                g_node.attr("class", "histogram_years");
                
                /* Achsenbeschriftung (x-Achse) innerhalb des gegebenen Gruppen-ELement erzeugen lassen */
                m_helper.create_year_text_in_group(g_node, m_years_min_max.min, data_arr.length, 850);
                
                /* Festhalten der Achsenbeschriftung innerhalb des defs-Blocks des SVG-Elements;
                 *  wird für den späteren Export der Grafik benötigt, um die Dateigröße klein zu halten,
                 *      indem alle Achsenbeschriftungen per use-Element darauf referenzieren */
                m_defs_node.append(g_year_node);
                
                /* Achsenbeschriftung nicht immer neu generieren lassen,
                 *  sondern die bestehende klonen und den Klon einfügen */
                $.each(g_nodes, function(i, d) {
                    var g_node_clone = g_year_node.clone();
                    g_node_clone.attr("transform", function(d) {
                        new_height = (i + 1) * 140 + 20;
                        return "translate(135, " + new_height + ")";
                    });
                    
                    $(d).after(g_node_clone);
                });
                
                item_g.append("text")
                    .attr("class", "item_title_text")
                    .attr("dx", "20px")
                    .attr("y", function(d, i) {
                        return ((i + 1) * 30) + "px";
                    })
                    .html(function(d, i) {
                        /* Topic-Name als Inhalt des Text-Elements setzen */
                        return d.topic;
                    })
                    .on('click', function(d, i) {
                        
                        var list_cnt = m_insp_topics_list.children().length;
                        var color_pos = list_cnt;                        
                        var class_number = "";
                        
                        var svg_elem_d3 = d3.select(m_insp_topics_diag.get(0));
                        var data_arr = [];
                        
                        
                        var active_topics = m_insp_topics_list.data('active_topics');
                        if(!active_topics)
                            active_topics = {};
                        
                        if(list_cnt < 5 && !active_topics[d.topic]) {
                            
                            /* 
                             * Farben von Topic wiederverwenden, die evtl. zuvor gelöscht wurden,
                             *  um mehreren Topics nicht die selbe Farbe zu zuweisen
                             */
                            var given_up_color_pos = m_insp_topics_list.data('given_up_color_pos');
                            if(given_up_color_pos && given_up_color_pos.length > 0) {
                                color_pos = given_up_color_pos.shift();
                            }
                            
                            class_number = ['one', 'two', 'three', 'four', 'five'][color_pos];
                            
                            var topic_list_entry_remove = $('<span>')
                                .html(' x ')
                                .addClass('close')
                                .data('color_pos', color_pos)
                                .on('click', function() {
                                    var path_node = m_insp_topics_diag.find('.' + class_number);

                                    var path_elem_cnt = m_insp_topics_list.children().length;
                                    
                                    if(path_elem_cnt === 1) {
                                        /* Inspektionsbereich schließen, wenn das letzte Topic aus dem Inspektionsbereich entfernt wird */
                                        var prev_height = m_content_wrapper_node.data('prev_height');
                                        
                                        m_inspector_area.fadeOut();
                                        m_content_wrapper_node.animate({ height: prev_height + 'px' }, 400, function() {
                                            m_content_wrapper_node.nanoScroller();
                                        });
                                    }
                                    else if(!m_insp_topics_diag.find('.' + class_number).hasClass('disabled')) {
                                        var enabled_path_elem_cnt = m_insp_topics_list.children().not('.disabled').length;
                                        svg_elem_d3.selectAll('path').transition().style('opacity', 1.0 / (enabled_path_elem_cnt - 1));
                                    }

                                    var active_topics = m_insp_topics_list.data('active_topics');
                                    active_topics[d.topic] = false;
                                    m_insp_topics_list.data('active_topics', active_topics);

                                    var given_up_color_pos = m_insp_topics_list.data('given_up_color_pos');
                                    if(!given_up_color_pos)
                                        given_up_color_pos = [];
                                    
                                    given_up_color_pos.push($(this).data('color_pos'));
                                    
                                    m_insp_topics_list.data('given_up_color_pos', given_up_color_pos);
                                    
                                    $(this).parent().remove();
                                    path_node.remove();
                                });
                            
                            
                            var topic_list_entry_title = $('<span>')
                                .html(d.topic)
                                .addClass('entry')
                                .addClass(class_number)
                                .on('mouseover', function() {
                                    var path_node = m_insp_topics_diag.find('.' + class_number);
                                    path_node.parent().parent().append(path_node.parent());
                                    d3.select(path_node.get(0)).transition().style('opacity', 1.0);
                                })
                                .on('mouseleave', function() {
                                    var path_node = m_insp_topics_diag.find('.' + class_number);
                                    var enabled_path_elem_cnt = m_insp_topics_list.children().not('.disabled').length;
                                    d3.select(path_node.get(0)).transition().style('opacity', 1.0 / enabled_path_elem_cnt);
                                })
                                .on('click', function() {
                                    var active_status = topic_list_entry.data('active');
                                    var path_node_d3 = d3.select(m_insp_topics_diag.find('.' + class_number).get(0));
                                    var visibility = 'visible';
                                    
                                    if(active_status) {
                                        visibility = 'hidden';
                                        $(this).css('color', '#fff').parent().addClass('disabled');
                                        active_status = false;
                                    }
                                    else {
                                        active_status = true;
                                        $(this).css('color', '').parent().removeClass('disabled');
                                    }
                                    
                                    path_node_d3.style('visibility', visibility);
                                    topic_list_entry.data('active', active_status);
                                    
                                    var enabled_path_elem_cnt = m_insp_topics_list.children().not('.disabled').length;
                                    svg_elem_d3.selectAll('path').transition().style('opacity', 1.0 / enabled_path_elem_cnt);
                                });
                            
                            var topic_list_entry = $('<li>')
                                .data('active', true)
                                .append(topic_list_entry_remove)
                                .append(topic_list_entry_title);
                            
                            
                            m_insp_topics_list.append(topic_list_entry);
                            active_topics[d.topic] = true;
                            m_insp_topics_list.data('active_topics', active_topics);
                            
                            var enabled_path_elem_cnt = m_insp_topics_list.children().not('.disabled').length;
                            
                            svg_elem_d3.append('g')
                                .attr('class', 'histogram')
                                .attr('transform', 'translate(0, 20)')
                                .append('path')
                                .attr('class', class_number)
                                .attr('d', function() {
                                    var histogram_arr = d.frequency_per_year;
                                    
                                    /* Jahresdaten für die Generierung des Histogrammpfads */
                                    data_arr = [];
                                    for(var i = m_years_min_max.min; i <= m_years_min_max.max; i++) {
                                        var val = histogram_arr[''+i];
                                        
                                        if(typeof(val) === 'undefined')
                                            val = 0;
                                        
                                        data_arr.push(val);
                                    }
                                    
                                    return m_helper.line_function(data_arr, 700, 60, m_histogram_min_max.max);
                                })
                                .style('opacity', 1.0 / (enabled_path_elem_cnt + 1));
                            
                            /* Pfade eine gewisse Transparenz geben, um übereinanderliegende Pfade besser unterscheiden zu können */
                            svg_elem_d3.selectAll('path').transition().style('opacity', 1.0 / enabled_path_elem_cnt);
                        }
                        
                        if(list_cnt === 0) {
                            /* Inspektionsbereich öffnen und Histogrammauflsitung verkleinern */
                            m_content_wrapper_node.data('prev_height', m_content_wrapper_node.height());
                            
                            m_content_wrapper_node.animate({ height: '400px' }, 400, function() {
                                m_inspector_area.fadeIn();
                                m_inspector_area.animate({ height: '170px' }, 400);
                                
                                m_content_wrapper_node.nanoScroller();
                            });
                            
                            /* Zeitachse erzeugen */
                            var time_axis_g_node = svg_elem_d3
                                                        .append('g')
                                                        .attr('transform', 'translate(15, 140)');
                            
                            m_helper.create_year_text_in_group(time_axis_g_node, m_years_min_max.min, data_arr.length, 700);
                        }
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
            m_node && m_node.stop().fadeOut(function() {
                m_svg_node.empty();
                
                var prev_height = m_content_wrapper_node.data('prev_height');
                m_content_wrapper_node.css({ height: prev_height + 'px' }, 400);
                m_inspector_area.fadeOut();
                
                m_insp_topics_diag.empty();
                m_insp_topics_list.empty();
                m_insp_topics_list.data('active_topics', {});
            });
            
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
