from flask import Flask, render_template, request, send_file, jsonify
from flask_socketio import SocketIO, send, emit
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
import logging

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chat.db'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
db = SQLAlchemy(app)
socketio = SocketIO(app, engineio_logger=True, ping_timeout=60, ping_interval=25)

partial_files = {}

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    userId = db.Column(db.String(64), nullable=False)
    username = db.Column(db.String(64), nullable=False)
    message = db.Column(db.Text, nullable=False)
    time = db.Column(db.DateTime, nullable=False)
    reply_to_id = db.Column(db.Integer, db.ForeignKey('message.id'), nullable=True)
    reply_to = db.relationship('Message', remote_side=[id])

class File(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    userId = db.Column(db.String(64), nullable=False)
    username = db.Column(db.String(64), nullable=False)
    fileName = db.Column(db.String(128), nullable=False)
    filePath = db.Column(db.String(256), nullable=False)
    time = db.Column(db.DateTime, nullable=False)
    message = db.Column(db.Text, nullable=True)  # Add this line

with app.app_context():
    db.create_all()

def ensure_uploads_directory():
    if not os.path.exists('uploads'):
        os.makedirs('uploads')

@app.route('/download/<filename>')
def download(filename):
    file_record = File.query.filter_by(fileName=filename).first()
    if file_record:
        return send_file(file_record.filePath, as_attachment=True)
    else:
        return "File not found", 404

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/messages')
def get_messages():
    messages = Message.query.order_by(Message.time).all()
    files = File.query.order_by(File.time).all()
    messages_data = [{
        'id': m.id,
        'userId': m.userId,
        'username': m.username,
        'message': m.message,
        'time': m.time.isoformat(),
        'reply': {
            'id': m.reply_to.id,
            'username': m.reply_to.username,
            'message': m.reply_to.message
        } if m.reply_to else None
    } for m in messages]
    files_data = [{
        'userId': f.userId,
        'username': f.username,
        'fileName': f.fileName,
        'time': f.time.isoformat(),
        'url': f'/download/{f.fileName}',
        'message': f.message  # Add this line
    } for f in files]
    return jsonify({'messages': messages_data, 'files': files_data})

@socketio.on('message')
def handleMessage(msg):
    time_obj = datetime.fromisoformat(msg['time'])
    reply_to = None
    if msg.get('reply') and msg['reply'].get('id'):
        reply_to = Message.query.get(msg['reply']['id'])
    new_message = Message(
        userId=msg['userId'], username=msg['username'], message=msg['message'],
        time=time_obj, reply_to=reply_to
    )
    db.session.add(new_message)
    db.session.commit()
    msg['id'] = new_message.id
    send(msg, broadcast=True)

@socketio.on('file')
def handleFile(data):
    try:
        global partial_files
        userId = data.get('userId')
        username = data.get('username')
        fileName = data.get('fileName')
        chunkData = data.get('chunkData')
        start = data.get('start')
        totalSize = data.get('totalSize')
        time = datetime.fromisoformat(data.get('time'))
        message = data.get('message')  # Add this line

        key = f"{userId}-{fileName}"
        if key not in partial_files:
            partial_files[key] = bytearray()

        partial_files[key] += bytearray(chunkData)

        if len(partial_files[key]) >= totalSize:
            ensure_uploads_directory()
            file_path = os.path.join('uploads', fileName)
            with open(file_path, 'wb') as f:
                f.write(partial_files[key])
            new_file = File(userId=userId, username=username, fileName=fileName, filePath=file_path, time=time, message=message)  # Modify this line
            db.session.add(new_file)
            db.session.commit()
            del partial_files[key]

            # Emit 'file' event only once per file upload
            emit('file', {'userId': userId, 'username': username, 'fileName': fileName, 'time': data.get('time'), 'url': f"/download/{fileName}", 'message': message}, broadcast=True)  # Modify this line
        else:
            # If the file is not yet complete, do not emit the 'file' event
            pass
    except Exception as e:
        app.logger.error(f"Error handling file upload: {e}")


if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG)
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, ssl_context=('cert.pem', 'privkey.pem'), allow_unsafe_werkzeug=True)

