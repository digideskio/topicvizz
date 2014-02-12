package topicvizz.core

import scala.beans.BeanProperty
import java.util.UUID

/**
  * Created with IntelliJ IDEA.
  * User: Baron
  * Date: 11.02.14
  * Time: 17:08
  * To change this template use File | Settings | File Templates.
  */
class TopicVizz_Author(@BeanProperty var sName: String) {

  val id: String = String.valueOf(UUID.randomUUID().hashCode())
  private var oFileList: List[TopicVizz_File] = List()
  private var oTopicList: List[TopicVizz_Topic] = List()

  /**
    *
    * @return
    */
  def files: Iterable[TopicVizz_File] = oFileList

  /**
    *
    * @param oTopicVizz_File
    */
  def addFile(oTopicVizz_File: TopicVizz_File): Unit = {
    oFileList = oTopicVizz_File :: oFileList
  }

  /**
    *
    * @param oTopicVizz_File
    * @return
    */
  def containsFile(oTopicVizz_File: TopicVizz_File): Boolean = {
    oFileList.contains(oTopicVizz_File)
  }

  /**
    *
    * @return
    */
  def topics: Iterable[TopicVizz_Topic] = oTopicList

  /**
    *
    * @param oTopicVizz_Topic
    */
  def addTopic(oTopicVizz_Topic: TopicVizz_Topic): Unit = {
    oTopicList = oTopicVizz_Topic :: oTopicList
  }

  /**
    *
    * @param oTopicVizz_Topic
    * @return
    */
  def containsTopic(oTopicVizz_Topic: TopicVizz_Topic): Boolean = {
    oTopicList.contains(oTopicVizz_Topic)
  }

}

