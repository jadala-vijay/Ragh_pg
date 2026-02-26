pipeline {
    agent any

    stages {

        stage('Clone Code') {
            steps {
                echo 'Cloning Repository...'
                git 'https://github.com/jadala-vijay/Ragh_pg.git'
            }
        }

        stage('Build') {
            steps {
                echo 'Build Started...'
                sh 'ls -la'
            }
        }

        stage('Test') {
            steps {
                echo 'Testing Application...'
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deployment Successful 🚀'
            }
        }
    }
}
