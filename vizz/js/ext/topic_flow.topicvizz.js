
(function($, window) {
    "use strict";

    /* Informationen über die Extension */
    var ext_info = {
        name:       'topic_flow',
        shortname:  'flow',
        id:         'flow_overlay'
    };

    var is_open = false;
    
    var m_diagram_width = 950;
    
    var m_node                  = null;
    var m_svg_node              = null;
    var m_flow_g_node           = null;
    var m_data                  = null;
    var m_helper                = null;
    var m_content_wrapper_node  = null;
    var m_content_node          = null;
    var m_graph_data            = null;
    
    var m_callbacks = {
        onShow: $.noop,
        onHide: $.noop
    };
    

    /* Hilfsvariablen, um das kleineste und größte Jahr festzuhalten */
    var m_years_min_max = null;
    
    /* Daten der ausgewählten Topics für die Weiterverwendung sichern */
    var m_selected_topics = [];
    
    /* Von d3.js bereitgestellte Funktion, um einen Pfad einfacher zu erzeugen */
    var path_func = d3.svg.line()
                        .x(function(d) { return d.x; })
                        .y(function(d) { return d.y; })
                        .interpolate("monotone");
            
    
    function create_flow_diagram(flow_g_node, selected_topics, years_min_max, max_width, max_height) {
        
        var overall_max_value = 0;
        var years_max_values = [];
        
        for(var i = years_min_max.min; i <= years_min_max.max; i++) {
            var value_sum = 0;
            
            var topics_values_per_year = [];
            
            $.each(selected_topics, function(j, d){
                value_sum += (d.frequency_per_year['' + i]) ? d.frequency_per_year['' + i]: 0;
            });
            
            if(value_sum > overall_max_value)
                overall_max_value = value_sum;
            
            years_max_values.push({ year: i, max_value: value_sum, last_y_pos: null });
        }
        
        
        var height_half = max_height / 2;    
        var width_step = max_width / (years_max_values.length + 2);
        
        $.each(selected_topics, function(i, topic) {
            
            flow_g_node.append('path')
                .attr("class", "flow_path " + topic.class_number)
                .attr("d", function() {

                    var path_data = [];
                    var path_data_back = [];
                    
                    var first_left_point = { 'x': 0,
                                             'y': height_half };
                    
                    path_data.push(first_left_point);
                    path_data_back.push(first_left_point);
                    
                    
                    /* Oberen und gleichzeitig unteren Punkt bestimmen */
                    for(var i = 0; i < years_max_values.length; i++) {
                        var year            = years_max_values[i].year;
                        var year_max_value  = years_max_values[i].max_value;
                        var last_y_pos      = years_max_values[i].last_y_pos;
                        
                        var topic_year_val = topic.frequency_per_year['' + year];
                        if(typeof(topic_year_val) === 'undefined')
                            topic_year_val = 0;
                         
                        var curr_path_height = max_height / overall_max_value * topic_year_val;
                        var curr_year_max_height = max_height / overall_max_value * year_max_value;
                        
                        if(last_y_pos === null) {
                            last_y_pos = height_half - curr_year_max_height / 2;
                        }
                        
                        /* Hin (->); oben */
                        path_data.push({'x': width_step * (i + 1),
                                        'y': last_y_pos - 0.5}); /* 0.5 für eine leichte Überlappung der Pfade */
                        
                        /* Zurück (<-); unten */
                        path_data_back.push({'x': width_step * (i + 1),
                                             'y': last_y_pos + curr_path_height});
                        
                        years_max_values[i].last_y_pos = last_y_pos + curr_path_height;
                    }
                    
                    /* Punkt rechts außen setzen */
                    var last_right_point = { 'x': (years_max_values.length + 1) * width_step,
                                             'y': height_half };
                    
                    path_data.push(last_right_point);
                    path_data.push(last_right_point);
                    path_data_back.push(last_right_point);
                    
                    /*
                     * Array mit den Punkten zurück, muss gespiegelt werden
                     *  und mit dem anderen Array (enthält die Puntkte hin) konkatiniert werden
                     */
                    path_data = path_data.concat(path_data_back.reverse());

                    /* Attributwert für 'd' zurückgeben */
                    return path_func(path_data);
                })
                .attr("stroke-width", "0");
        });
        
        
        /* y-Achse  */
        var y_axis_g_node = d3.select($(flow_g_node.node()).parent().find('g.value_axis')[0]);
        
        if(selected_topics.length === 0) {
            y_axis_g_node.selectAll('*').remove();
        }
        else {
            var half_o_max_value = overall_max_value / 2.0;
            var y = d3.scale.linear()
                            .domain([-half_o_max_value, half_o_max_value])
                            .range([0, max_height - 10]);
            var value_axis = d3.svg.axis()
                                   .orient('right')
                                   .tickFormat(function(d) {
                                        return "" + ((parseInt(d) == parseFloat(d) && !isNaN(d) || Math.abs(d % 1) === 0.5) ? Math.abs(d): "");
                                   })
                                   .scale(y);
            y_axis_g_node.call(value_axis);
        }
    }    
    

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
            
            m_years_min_max = graph_data.years_min_max;
            
            if(callbacks && callbacks.onShow && callbacks.onHide)
                m_callbacks = callbacks;
            
            node.attr('id', ext_info.id);
            
            var heading = $('<h2>').html('Term-Flow');
            node.append(heading);
            
            var close_button = $('<div>').addClass('overlay_close_button');
            close_button.on('click', function() {
                ext.hide();
            });
            node.append(close_button);
                        
            var svg_wrapper = $('<div>').addClass('flow_diagram');
            
                var svg = $(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
                svg.attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
                
                svg_wrapper.append(svg);
                m_svg_node = svg;
                
                
                /* Gruppe für die Pfade erzeugen */
                m_flow_g_node = $(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
                m_flow_g_node.attr('class', 'flow_components');
                m_svg_node.append(m_flow_g_node);
                m_flow_g_node = d3.select(m_flow_g_node.get(0));
                
                var ticks_cnt = m_years_min_max.max - m_years_min_max.min + 3;
                
                m_flow_g_node.attr('transform', 'translate(35, 10)');
                
                /* Zeitachse (x-Achse) erzeugen */    
                var time_axis_g_node = $(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
                time_axis_g_node.attr('class', 'time_axis');
                m_svg_node.append(time_axis_g_node);
                
                var year_cnt = m_years_min_max.max - m_years_min_max.min + 1;

                time_axis_g_node = d3.select(time_axis_g_node.get(0));
                time_axis_g_node.attr('transform', 'translate(50, 390)');
                
                m_helper.create_year_text_in_group(time_axis_g_node, m_years_min_max.min, year_cnt, m_diagram_width);
                
                /* Wertachse (y-Achse) erzeugen */
                var value_axis_g_node = $(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
                value_axis_g_node.attr('class', 'value_axis');
                m_svg_node.append(value_axis_g_node);
                
                value_axis_g_node = d3.select(value_axis_g_node.get(0));
                value_axis_g_node.attr('transform', 'translate(' + (m_diagram_width) + ', 10)');
                
                
            node.append(svg_wrapper);
            
            
            m_content_wrapper_node = $('<div>').addClass('content_wrapper')
                                            .addClass('nano');

                m_content_node = $('<div>').addClass('content');
                    
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
            
            
            var sub_bar = $('<div>').addClass('sub_bar');
            
                var input_btn = $('<input>').attr('type', 'button')
                                            .attr('id', 'flow_export_button')
                                            .val('Als Grafik exportieren...');
                    
                /*
                 *  Export-Button, um das Diagramm innerhalb des Popups als Grafik zu exportieren
                 */
                input_btn.on("click", function(e) {
                    
                    var svg_title = "Topic-Flow";
                    
                    var svg_elem = m_svg_node.clone()
                        .attr({
                            "version": "1.1",
                            "xmlns": "http://www.w3.org/2000/svg"
                        }).prepend("<title>" + svg_title + "</title>");
                        
                    svg_elem.append('<defs>').find('defs')
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
                                            
                                            ".value_axis path.domain {\n" +
                                                "fill: transparent;\n" +
                                                "stroke: rgb(0, 0, 0);\n" +
                                            "}\n" +
                                            
                                        "]]>\n" + 
                                    "</style>\n");
                    
                    var topic_list_g_node = svg_elem.append('<g class="topic_list">').find('g.topic_list');
                    
                    topic_list_g_node.attr('transform', 'translate(60, 470)');
                    topic_list_g_node.append('<text class="legend_titel" style="font-weight: bold;">Topics</text>');
                    
                    $.each(m_selected_topics, function(i, d) {
                        var text_node = $('<text class="'+ d.class_number +'">' + d.topic + '</text>');
                        text_node.attr('transform', 'translate(20, ' + ((i + 1) * 20 + 10) + ')');
                        
                        topic_list_g_node.append(text_node);
                    });
                    
                    svg_elem.find('.one').css('fill', '#6eb551');
                    svg_elem.find('.two').css('fill', '#b5517d');
                    svg_elem.find('.three').css('fill', '#518cb5');
                    svg_elem.find('.four').css('fill', '#51b59b');
                    svg_elem.find('.five').css('fill', '#b5a351');
                    
                    var wrapper_parent = $('<div>').append(svg_elem);
                    var svg_html = "<?xml version=\"1.0\" encoding=\"utf-8\" ?>\n" + 
                                   "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">" +
                                   wrapper_parent.html();
                    
                    window.open("data:image/svg+xml;base64,"+ btoa(unescape(encodeURIComponent(svg_html))), 'Topic-Flow Diagramm');
                });
                
                sub_bar.append(input_btn);
                
            node.append(sub_bar);
            
            
            /* Listen mit Topics erzeugen */
            var nodes = m_graph_data.nodes;
            var items_per_column = Math.ceil(nodes.length / 4);
            var list_node = {};
            
            $.each(nodes, function(i, node) {
                if((i % items_per_column) === 0 ) {
                    list_node = $('<ul>');
                    m_content_node.append(list_node);
                }
                
                var topic_list_item = $('<li>').html(node.topic);
                
                /* Pfad bei Klick auf ein Topic in der Topicliste hinzufügen/entfernen */
                topic_list_item.on('click', function() {
                    
                    var active_topics = m_content_node.data('active_topics');
                    
                    if(!active_topics)
                        active_topics = {};
                    
                    var list_cnt = m_selected_topics.length;
                    var given_up_color_pos = m_content_node.data('given_up_color_pos');
                    
                    if(!given_up_color_pos)
                        given_up_color_pos = [];

                    m_flow_g_node.selectAll('path').remove()
                    
                    if(active_topics[node.topic]) {
                        var found_index = -1;
                        
                        for(var i = 0; i < m_selected_topics.length; i++) {
                            if(m_selected_topics[i].topic === node.topic)
                                found_index = i;
                        }
                        
                        if(found_index < 0)
                            return;
                        
                        var removed_topic = m_selected_topics.splice(found_index, 1);
                        removed_topic.class_number = null
                        active_topics[node.topic] = false;
                        
                        given_up_color_pos.push(topic_list_item.data('color_pos'));
                        m_content_node.data('given_up_color_pos', given_up_color_pos);
                        topic_list_item.attr('class', null);
                    }
                    else if(list_cnt < 5) {
                        
                        var color_pos = list_cnt;
                        var class_number = "";
                        
                        if(given_up_color_pos && given_up_color_pos.length > 0) {
                            color_pos = given_up_color_pos.shift();
                        }
                        
                        topic_list_item.data('color_pos', color_pos);
                        class_number = ['one', 'two', 'three', 'four', 'five'][color_pos];
                        node.class_number = class_number;
                        m_selected_topics.push(node);
                        active_topics[node.topic] = true;
                        
                        topic_list_item.addClass(class_number);
                    }
                    
                    create_flow_diagram(m_flow_g_node, m_selected_topics, m_years_min_max, m_diagram_width, 370);
                    
                    m_content_node.data('given_up_color_pos', given_up_color_pos);
                    m_content_node.data('active_topics', active_topics);
                });
                
                list_node.append(topic_list_item);
            });
        },
        
        /* ### SHOW ### - */
        show: function() {
            
            is_open = true;
            
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
            m_node && m_node.stop().fadeOut();
            
            /* Nano-Scrollbar zerstören */
            m_node.find(".nano").nanoScroller({ stop: true });
            
            is_open = false;
        },
        
        /* ### IS_OPEN ### */
        is_open: function() {
            return is_open;
        },
        
        /* Kontrollierten Zugriff auf Datenbestände innerhalb der Extension erlauben;
         *  von Extension zu Extension unterschiedlich */
        actions: {
            
        }
    };

    /* Prüfen ob TopicVizz eingebunden ist und die Extension hinzugefügt werden kann */
    (       TopicVizz
        &&  TopicVizz.bindExtension
        &&  TopicVizz.bindExtension(ext) );

}(this.jQuery, window));
