
(function($, window) {

    /* Informationen über die Extension */
    var ext_info = {
        name:       'authors_charts',
        shortname:  'authors',
        id:         'authors_overlay'
    };
    
    var is_open = false;
    
    var m_node              = null;
    var m_content_node      = null;
    var m_data              = null;
    var m_graph_data        = null;
    
    var m_callbacks = {
        onShow: $.noop,
        onHide: $.noop
    };
    
    
    /* Liste von Autoren */
    var m_authors = null;
    
    /* Dokumente zu Topics */
    var m_docs = {};
    
    
    var ext = {
        /* ### INFO ### */ 
        info: ext_info,
        
        eval_topic: function(topic) {
            
            /* Map-Erzeugung für Dokument -> Topics */
            for(var arr_pos in topic.files) {
                var filename = topic.files[arr_pos];
                
                if(!m_docs[filename]) {
                    m_docs[filename] = [];
                }
                
                m_docs[filename].push(topic);
            }
        },
        
        /* ### INIT ### - Funktion die von TopicVizz zur Initialisierungsphase aufgerufen wird */
        init: function(node, data, graph_data, callbacks) {
            
            m_node              = node;
            m_data              = data;
            m_graph_data        = graph_data;
            
            if(callbacks && callbacks.onShow && callbacks.onHide)
                m_callbacks = callbacks;
            
            node.attr('id', ext_info.id);
            
            m_authors = data.authors;
            
            /* Häufigkeit der Topics auf den Autor bezogen */
            $.each(m_authors, function(i, author) {
                author.topics_mentioned_ranking = {};
                
                $.each(author.files, function(i, filename) {
                    
                    if(m_docs[filename]) {
                        
                        $.each(m_docs[filename], function(i, topic) {
                            
                            if(!author.topics_mentioned_ranking[topic.id]) {
                                author.topics_mentioned_ranking[topic.id] = {topic_id: topic.id, count: 1, data: topic};
                            }
                            else {
                                author.topics_mentioned_ranking[topic.id].count++;
                            }
                        });
                    }
                });
            });
            
            /* Auf Autor bezogene Topics nach Häufigkeit sortieren */
            $.each(m_authors, function(i, author){
                var topics_dict = author.topics_mentioned_ranking;
                var topics_arr = [];
                
                $.each(topics_dict, function(i, topic) {
                    topics_arr.push(topic);
                });
                
                topics_arr.sort(function(a, b) {
                    return b.count - a.count;
                });
                
                author.topics_mentioned_ranking = topics_arr;
            });
            
            
            var heading = $('<h2>').html('Autoren');
            node.append(heading);
            
            var close_button = $('<div>').addClass('overlay_close_button');
            close_button.on('click', function() {
                ext.hide();
            });
            node.append(close_button);
            
            var content_wrapper = $('<div>').addClass('content_wrapper');
            node.append(content_wrapper);
            
                var content = $('<div>').addClass('content');
                content_wrapper.append(content);
                m_content_node = content;
            
            
        },
        
        /* ### SHOW ### */
        show: function(node, data) {
            
            is_open = true;
            
            // Der Content existiert noch nicht, weshalb er noch erzeugt werden muss
            if(m_content_node.children().length === 0) {
            
                $.each(m_authors, function(i, author) {
                    
                    var author_con = $('<div></div>').attr('class', 'author_con_entry');
                    
                    var author_heading = $('<h2></h2>').html(author.name);
                    author_con.append(author_heading);
                    
                    var author_data = $('<div></div>').attr('class', 'author_data');
                    author_con.append(author_data);
                    
                    /* Aufstellen der persönlichen Topic-Charts */
                    
                    var author_topics = $('<div></div>').attr('class', 'author_topic_charts');
                    author_data.append(author_topics);
                    author_topics.append('<h3>Topics nach Häufigkeit</h3>');
                    var topic_charts = $('<table></table>');
                    author_topics.append(topic_charts);
                    
                    for(var i = 0; i < author.topics_mentioned_ranking.length && i < 5; i++) {
                        
                        var curr_topic = author.topics_mentioned_ranking[i];
                        
                        var topic_entry = $('<tr><td></td><td></td></tr>')
                            .attr('class', 'topic_entry');
                        topic_entry.find('td:first')
                            .attr('class', 'count_num')
                            .html(curr_topic.count);
                        topic_entry.find('td:last')
                            .attr('class', 'topic_name')
                            .html(curr_topic.data.topic);
                        topic_charts.append(topic_entry);
                    }
                    
                    
                    /* Auflistung der Dokumente mit Verlinkung */
                    var author_documents = $('<div></div>').attr('class', 'author_documents_list');
                    author_data.append(author_documents);
                    author_documents.append('<h3>Dokumente</h3>');
                    var documents_list = $('<ul></ul>');
                    author_documents.append(documents_list);
                    
                    for(var pos in author.files) {
                        var document_entry = $('<li><a></a></li>');
                        document_entry.find('a')
                            .attr('href', '#' + author.files[pos])
                            .attr('target', '_blank')
                            .html(author.files[pos]);
                        documents_list.append(document_entry);
                    }
                    
                    author_data.append($('<div></div>').attr('class', 'clear_fix'));
                    
                    author_con.append($('<div></div>').attr('class', 'seperator'));
                    
                    m_content_node.append(author_con);
                });
            }
            
            /* Finales Einblenden */
            m_node && m_node.stop().fadeIn();
            
            /* Nano-Scrollbar initialisieren */
            m_node.find(".nano").nanoScroller({ flash: true });
            
            m_callbacks.onShow();
        },
        
        /* ### HIDE ### - Funktion die bei jedem Verstecken aufgerufen wird (Overlaywechsel etc.) */
        hide: function(node, data) {
            
            /* Popup bzw. Overlay ausblenden */
            m_node && m_node.stop().fadeOut();
            /* Nano-Scrollbar zerstören */
            m_node.find(".nano").nanoScroller({ stop: true });
            
             m_callbacks.onHide();
            
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
