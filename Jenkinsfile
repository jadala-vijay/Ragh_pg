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
                echo 'Installing npm packages...'
                dir('pg_backend') {
                    sh 'npm install'
                }
            }
        }

        stage('Build') {
            steps {
                echo 'Building Application...'
                dir('pg_backend') {
                    sh 'npm run build || echo "No build script"'
                }
            }
        }

        stage('Run App') {
            steps {
                echo 'Starting Application...'
                dir('pg_backend') {
                    sh 'npm start || echo "No start script"'
                }
            }
        }
    }
}
