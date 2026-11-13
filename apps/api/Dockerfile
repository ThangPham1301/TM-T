FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src src
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp package -Dmaven.test.skip=true
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN mkdir /data && chown 10001:10001 /data
COPY --from=build /app/target/store-api-1.0.0.jar app.jar
USER 10001
ENTRYPOINT ["java", "-jar", "app.jar"]
