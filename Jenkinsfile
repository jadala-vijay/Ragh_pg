pipeline {
    agent any

    stages {

        stage('Clone Code') {
            steps {
                echo 'Cloning Repository...'
                git branch: 'main',
                    url: 'https://github.com/jadala-vijay/Ragh_pg.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('pg_backend') {
                    sh 'npm install'
                }
            }
        }

        stage('Install Serverless Locally') {
            steps {
                dir('pg_backend') {
                    sh 'npm install serverless'
                }
            }
        }

        stage('Deploy to AWS') {
            steps {
                dir('pg_backend') {
                    sh 'npx serverless deploy'
                }
            }
        }
    }
}
