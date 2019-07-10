import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { formatFileSize } from './utils/helpers';
import CancellationToken from './utils/CancellationToken';
import dicomUploader from './api/DicomUploadService';
import './googleCloud.css';

export default class DicomUploader extends Component {
  constructor(props) {
    super(props);
    this.state = {
      status: 'Upload',
      isCancelled: false,
      errorsCount: 0,
      files: null,
      uploadedVolume: null,
      wholeVolumeStr: null,
      isFilesListHidden: true,
      timeLeft: null,
      uploadedList: null,
      totalCount: 0,
      successfullyUploadedCount: 0,
      lastFile: '',
      uploadContext: null, // this is probably not needed, but we use this variable to destinguish between different downloads
    };
    this.uploadFiles = this.uploadFiles.bind(this);
  }

  static propTypes = {
    id: PropTypes.string,
    event: PropTypes.string,
    url: PropTypes.string,
    oidcKey: PropTypes.string,
  };
  static defaultProps = {};

  filesLeft() {
    return (
      this.state.uploadedList.length + ' of ' + this.state.totalCount + ' files'
    );
  }

  volumeLeft() {
    let left = formatFileSize(this.state.uploadedVolume);
    return left + ' of ' + this.state.wholeVolumeStr;
  }

  percents() {
    return parseInt(
      (100 * this.state.uploadedList.length) /
        Object.keys(this.state.files).length
    );
  }

  isFinished() {
    return (
      this.state.isCancelled ||
      Object.keys(this.state.files).length === this.state.uploadedList.length
    );
  }

  errorsMessage() {
    const errors = this.state.errorsCount === 1 ? ' error' : ' errors';
    return (
      this.state.errorsCount + errors + ' while uploading, click for more info'
    );
  }

  uploadFiles(files) {
    const filesArray = Array.from(files.target.files);
    const filesDict = {};
    filesArray.forEach((file, i) => {
      const fileDesc = {
        id: i,
        name: file.name,
        path: file.webkitRelativePath || file.name,
        size: file.size,
        error: null,
        processed: false,
        processedInUI: false,
      };
      filesDict[i] = fileDesc;
      file.fileId = i;
    });
    const wholeVolume = filesArray.map(f => f.size).reduce((a, b) => a + b);
    const uploadContext = Math.random();
    this.setState({
      status: 'Uploading...',
      files: filesDict,
      uploadedList: [],
      uploadedVolume: 0,
      lastFile: filesArray[0].name,
      totalCount: filesArray.length,
      wholeVolumeStr: formatFileSize(wholeVolume),
      uploadContext: uploadContext,
      cancellationToken: new CancellationToken(),
    });
    const cancellationToken = new CancellationToken();
    const uploadCallback = (fileId, error) =>
      uploadContext === this.state.uploadContext &&
      this.uploadCallback.call(this, fileId, error);
    dicomUploader.setOidcStorageKey(this.props.oidcKey);
    dicomUploader.smartUpload(
      files.target.files,
      this.props.url,
      this.props.oidcKey,
      uploadCallback,
      cancellationToken
    );
  }

  uploadCallback(fileId, error) {
    const file = this.state.files[fileId];
    file.processed = true;
    if (!error) {
      let uploadedVolume = this.state.uploadedVolume + file.size;
      this.setState({ uploadedVolume: uploadedVolume });
    } else {
      file.error = error;
      this.setState({ errorsCount: this.state.errorsCount + 1 });
    }
    this.setState({ lastFile: file.name });
    let uploadedList = this.state.uploadedList;
    uploadedList.push(file);
    this.setState({ uploadedList: uploadedList });
  }

  renderTableRow(file) {
    let error = <></>;
    if (file.error != null) {
      error = (
        <>
          <font color="red">{file.error}</font>
        </>
      );
    }
    return (
      <tr key={file.id}>
        <td className="project">
          {file.name} {error}
        </td>
      </tr>
    );
  }

  render() {
    if (this.state.files == null) {
      return (
        <div className="gcp-dicom-uploader">
          <div className="button">
            <label htmlFor="file">
              <img src="./assets/Button_File.svg" alt="upload file"></img>
            </label>
            <input
              className="gcp-invisible-input"
              accept=".dcm"
              onChange={this.uploadFiles}
              type="file"
              id="file"
              multiple
            />
          </div>

          <div className="button">
            <label htmlFor="folder">
              <img src="./assets/Button_Folder.svg" alt="upload folder"></img>
            </label>
            <input
              className="gcp-invisible-input"
              type="file"
              onChange={this.uploadFiles}
              id="folder"
              webkitdirectory="true"
              mozdirectory="true"
              multiple
            />
          </div>
        </div>
      );
    } else {
      return (
        <>
          <table
            id="tblProjectList"
            className="studyListToolbar table noselect"
          >
            <thead>
              <tr>
                <th className="gcp-picker--path">
                  {this.percents()}% {this.filesLeft()}
                </th>
              </tr>
            </thead>
            <tbody id="ProjectList">
              {this.state.uploadedList.map(file => {
                return this.renderTableRow(file);
              })}
            </tbody>
          </table>
        </>
      );
    }
  }
}
