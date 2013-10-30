import com.typesafe.sbt.SbtScalariform
import com.typesafe.sbt.SbtScalariform.ScalariformKeys
import sbt._
import Keys._

object  TopicVizz extends Build {

  lazy val formatSettings = SbtScalariform.scalariformSettings ++ Seq(
    ScalariformKeys.preferences in Compile := formattingPreferences,
    ScalariformKeys.preferences in Test := formattingPreferences
  )

  import scalariform.formatter.preferences._

  def formattingPreferences =
    FormattingPreferences()
      .setPreference(RewriteArrowSymbols, true)
      .setPreference(AlignParameters, true)
      .setPreference(AlignSingleLineCaseStatements, true)
      .setPreference(DoubleIndentClassDeclaration, true)
      .setPreference(PlaceScaladocAsterisksBeneathSecondAsterisk, true)


  lazy val projectSettings = Defaults.defaultSettings ++ Seq(
    name := "TopicVizz 2013",
    version := "1.0.0",
    organization := "de.fhk.topicvizz",
    scalaVersion := "2.10.3",
    javacOptions ++= Seq("-source", "1.7"),
    fork in run := true,
    resolvers += Resolvers.typesafeReleaseRepo,
    resolvers += Resolvers.typesafeSnapshotRepo,
    resolvers += Resolvers.sonatypeSnapshotRepo
  )


  lazy val topicVizzProject = Project("topicVizz", file("."), settings = projectSettings ++ formatSettings)
}


object Resolvers {
  lazy val typesafeReleaseRepo = "Typesafe Snapshot Repository" at "http://repo.typesafe.com/typesafe/snapshots/"
  lazy val typesafeSnapshotRepo = "Typesafe Release Repository" at "http://repo.typesafe.com/typesafe/releases/"
  lazy val sonatypeSnapshotRepo = "Sonatype Snapshots Repository" at "https://oss.sonatype.org/content/repositories/snapshots/"
}
