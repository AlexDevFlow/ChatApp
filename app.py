from flask import Flask, render_template, request, Response, send_file
from flask_socketio import SocketIO, send, emit
from collections import defaultdict
import io

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
socketio = SocketIO(app)

partial_files = defaultdict(bytearray)
completed_files = {}

@app.route('/download/<filename>')
def download(filename):
    if filename in completed_files:
        file_data = io.BytesIO(completed_files[filename])
        response = Response(file_data, mimetype='application/octet-stream')
        response.headers['Content-Disposition'] = f'attachment; filename={filename}'
        return response
    else:
        return "File not found", 404

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('message')
def handleMessage(msg):
    send(msg, broadcast=True)

@socketio.on('file')
def handleFile(data):
    global partial_files, completed_files
    username = data.get('username')
    fileName = data.get('fileName')
    chunkData = data.get('chunkData')
    start = data.get('start')
    totalSize = data.get('totalSize')
    time = data.get('time')

    key = f"{username}-{fileName}"
    partial_files[key] += bytearray(chunkData)

    if len(partial_files[key]) >= totalSize:
        completed_files[fileName] = partial_files[key]
        del partial_files[key]

    emit('file', {'username': username, 'fileName': fileName, 'time': time, 'url': f"/download/{fileName}"}, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)