/**
 * Submit command for interactive assignment submission
 */

const fs = require('fs');
const path = require('path');
const { makeCanvasRequest } = require('../lib/api-client');
const { createReadlineInterface, askQuestion } = require('../lib/interactive');
const { uploadSingleFileToCanvas, submitAssignmentWithFiles } = require('../lib/file-upload');

async function submitAssignment(options) {
  const rl = createReadlineInterface();
  
  try {
    let courseId = options.course;
    let assignmentId = options.assignment;
    let filePath = options.file;
    let selectedCourse = null;
    let selectedAssignment = null;
    
    // Step 1: Select Course (if not provided)
    if (!courseId) {
      console.log('📚 Loading your starred courses...\n');
      
      const courses = await makeCanvasRequest('get', 'courses', [
        'enrollment_state=active',
        'include[]=favorites'
      ]);
      
      if (!courses || courses.length === 0) {
        console.log('No courses found.');
        rl.close();
        return;
      }
      
      // Filter for starred courses by default
      let starredCourses = courses.filter(course => course.is_favorite);
      
      if (starredCourses.length === 0) {
        console.log('No starred courses found. Showing all enrolled courses...\n');
        starredCourses = courses;
      }
      
      console.log('Select a course:');
      starredCourses.forEach((course, index) => {
        const starIcon = course.is_favorite ? '⭐ ' : '';
        console.log(`${index + 1}. ${starIcon}${course.name}`);
      });
      
      const courseChoice = await askQuestion(rl, '\nEnter course number: ');
      const courseIndex = parseInt(courseChoice) - 1;
      
      if (courseIndex < 0 || courseIndex >= starredCourses.length) {
        console.log('Invalid course selection.');
        rl.close();
        return;
      }
      
      selectedCourse = starredCourses[courseIndex];
      courseId = selectedCourse.id;
      console.log(`✅ Selected: ${selectedCourse.name}\n`);
    } else {
      // Fetch course details if ID was provided
      try {
        selectedCourse = await makeCanvasRequest('get', `courses/${courseId}`);
      } catch (error) {
        console.log(`⚠️  Could not fetch course details for ID ${courseId}`);
        selectedCourse = { id: courseId, name: `Course ${courseId}` };
      }
    }
    
    // Step 2: Select Assignment (if not provided)
    if (!assignmentId) {
      console.log('📝 Loading assignments...\n');
      
      const assignments = await makeCanvasRequest('get', `courses/${courseId}/assignments`, [
        'include[]=submission',
        'order_by=due_at',
        'per_page=100'
      ]);
      
      if (!assignments || assignments.length === 0) {
        console.log('No assignments found for this course.');
        rl.close();
        return;
      }
      
      console.log(`Found ${assignments.length} assignment(s):\n`);
      
      // Show summary of assignment statuses
      const submittedCount = assignments.filter(a => a.submission && a.submission.submitted_at).length;
      const pendingCount = assignments.length - submittedCount;
      const uploadableCount = assignments.filter(a => 
        a.submission_types && 
        a.submission_types.includes('online_upload') && 
        a.workflow_state === 'published'
      ).length;
      
      console.log(`📊 Summary: ${submittedCount} submitted, ${pendingCount} pending, ${uploadableCount} accept file uploads\n`);
      console.log('Select an assignment:');
      assignments.forEach((assignment, index) => {
        const dueDate = assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : 'No due date';
        const submitted = assignment.submission && assignment.submission.submitted_at ? '✅' : '❌';
        
        // Check if assignment accepts file uploads
        const canSubmitFiles = assignment.submission_types && 
                              assignment.submission_types.includes('online_upload') &&
                              assignment.workflow_state === 'published';
        const submissionIcon = canSubmitFiles ? '📤' : '📋';
        
        // Format grade like Canvas web interface
        let gradeDisplay = '';
        const submission = assignment.submission;
        
        if (submission && submission.score !== null && submission.score !== undefined) {
          const score = submission.score % 1 === 0 ? Math.round(submission.score) : submission.score;
          const total = assignment.points_possible || 0;
          gradeDisplay = ` | Grade: ${score}/${total}`;
        } else if (submission && submission.excused) {
          gradeDisplay = ' | Grade: Excused';
        } else if (submission && submission.missing) {
          gradeDisplay = ' | Grade: Missing';
        } else if (assignment.points_possible) {
          gradeDisplay = ` | Grade: –/${assignment.points_possible}`;
        }
        
        console.log(`${index + 1}. ${submissionIcon} ${assignment.name} ${submitted}`);
        console.log(`   Due: ${dueDate} | Points: ${assignment.points_possible || 'N/A'}${gradeDisplay}`);
        if (!canSubmitFiles) {
          console.log(`   📋 Note: This assignment doesn't accept file uploads`);
        }
      });
      
      const assignmentChoice = await askQuestion(rl, '\nEnter assignment number: ');
      const assignmentIndex = parseInt(assignmentChoice) - 1;
      
      if (assignmentIndex < 0 || assignmentIndex >= assignments.length) {
        console.log('Invalid assignment selection.');
        rl.close();
        return;
      }
      
      const      selectedAssignment = assignments[assignmentIndex];
      
      // Check if assignment accepts file uploads
      if (!selectedAssignment.submission_types || 
          !selectedAssignment.submission_types.includes('online_upload') ||
          selectedAssignment.workflow_state !== 'published') {
        console.log('❌ This assignment does not accept file uploads or is not published.');
        rl.close();
        return;
      }
      
      assignmentId = selectedAssignment.id;
      console.log(`✅ Selected: ${selectedAssignment.name}\n`);
      
      // Check if already submitted
      if (selectedAssignment.submission && selectedAssignment.submission.submitted_at) {
        const resubmit = await askQuestion(rl, 'This assignment has already been submitted. Do you want to resubmit? (y/N): ');
        if (resubmit.toLowerCase() !== 'y' && resubmit.toLowerCase() !== 'yes') {
          console.log('Submission cancelled.');
          rl.close();
          return;
        }
      }
    } else {
      // Fetch assignment details if ID was provided
      try {
        selectedAssignment = await makeCanvasRequest('get', `courses/${courseId}/assignments/${assignmentId}`);
      } catch (error) {
        console.log(`⚠️  Could not fetch assignment details for ID ${assignmentId}`);
        selectedAssignment = { id: assignmentId, name: `Assignment ${assignmentId}` };
      }
    }
      // Step 3: Select Files (if not provided)
    let filePaths = [];
    if (filePath) {
      filePaths = [filePath]; // Single file provided via option
    } else {
      filePaths = await selectFilesImproved(rl);
    }
    
    // Validate all selected files exist
    const validFiles = [];
    for (const file of filePaths) {
      if (fs.existsSync(file)) {
        validFiles.push(file);
      } else {
        console.log(`⚠️  File not found: ${file}`);
      }
    }
    
    if (validFiles.length === 0) {
      console.log('No valid files selected.');
      rl.close();
      return;
    }
    
    filePaths = validFiles;
      // Step 4: Confirm and Submit
    console.log('\n📋 Submission Summary:');
    console.log(`📚 Course: ${selectedCourse?.name || 'Unknown Course'}`);
    console.log(`📝 Assignment: ${selectedAssignment?.name || 'Unknown Assignment'}`);
    console.log(`📁 Files (${filePaths.length}):`);
    filePaths.forEach((file, index) => {
      const stats = fs.statSync(file);
      const size = (stats.size / 1024).toFixed(1) + ' KB';
      console.log(`  ${index + 1}. ${path.basename(file)} (${size})`);
    });
    
    const confirm = await askQuestion(rl, '\nProceed with submission? (Y/n): ');
    if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
      console.log('Submission cancelled.');
      rl.close();
      return;
    }
    
    console.log('\n🚀 Uploading files...');
    
    // Upload all files
    const uploadedFileIds = [];
    for (let i = 0; i < filePaths.length; i++) {
      const currentFile = filePaths[i];
      console.log(`📤 Uploading ${i + 1}/${filePaths.length}: ${path.basename(currentFile)}`);
      
      try {
        const fileId = await uploadSingleFileToCanvas(courseId, assignmentId, currentFile);
        uploadedFileIds.push(fileId);
        console.log(`✅ ${path.basename(currentFile)} uploaded successfully`);
      } catch (error) {
        console.error(`❌ Failed to upload ${currentFile}: ${error.message}`);
        const continueUpload = await askQuestion(rl, 'Continue with remaining files? (Y/n): ');
        if (continueUpload.toLowerCase() === 'n' || continueUpload.toLowerCase() === 'no') {
          break;
        }
      }
    }
    
    if (uploadedFileIds.length === 0) {
      console.log('❌ No files were uploaded successfully.');
      rl.close();
      return;
    }
    
    // Submit the assignment with all uploaded files
    console.log('\n📝 Submitting assignment...');
    const submission = await submitAssignmentWithFiles(courseId, assignmentId, uploadedFileIds);
    
    console.log(`✅ Assignment submitted successfully with ${uploadedFileIds.length} file(s)!`);
    console.log(`Submission ID: ${submission.id}`);
    console.log(`Submitted at: ${new Date(submission.submitted_at).toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Submission failed:', error.message);
  } finally {
    rl.close();
  }
}

async function selectFiles(rl) {
  console.log('📁 File selection options:');
  console.log('1. Enter file path(s) manually');
  console.log('2. Select from current directory');
  
  const fileChoice = await askQuestion(rl, '\nChoose option (1-2): ');
  
  if (fileChoice === '1') {
    return await selectFilesManually(rl);
  } else if (fileChoice === '2') {
    return await selectFilesFromDirectory(rl);
  } else {
    console.log('Invalid option.');
    return [];
  }
}

async function selectFilesManually(rl) {
  const singleOrMultiple = await askQuestion(rl, 'Submit single file or multiple files? (s/m): ');
  const filePaths = [];
  
  if (singleOrMultiple.toLowerCase() === 'm' || singleOrMultiple.toLowerCase() === 'multiple') {
    console.log('Enter file paths (one per line). Press Enter on empty line to finish:');
    let fileInput = '';
    while (true) {
      fileInput = await askQuestion(rl, 'File path: ');
      if (fileInput === '') break;
      filePaths.push(fileInput);
    }
  } else {
    const singleFile = await askQuestion(rl, 'Enter file path: ');
    filePaths.push(singleFile);
  }
  
  return filePaths;
}

async function selectFilesFromDirectory(rl) {
  try {
    const files = fs.readdirSync('.').filter(file => 
      fs.statSync(file).isFile() && 
      !file.startsWith('.') &&
      file !== 'package.json' &&
      file !== 'README.md'
    );
    
    if (files.length === 0) {
      console.log('No suitable files found in current directory.');
      const manualFile = await askQuestion(rl, 'Enter file path manually: ');
      return [manualFile];
    }
    
    console.log('\nFiles in current directory:');
    files.forEach((file, index) => {
      const stats = fs.statSync(file);
      const size = (stats.size / 1024).toFixed(1) + ' KB';
      console.log(`${index + 1}. ${file} (${size})`);
    });
    
    const multipleFiles = await askQuestion(rl, '\nSelect multiple files? (y/N): ');
    
    if (multipleFiles.toLowerCase() === 'y' || multipleFiles.toLowerCase() === 'yes') {
      return await selectMultipleFilesFromList(rl, files);
    } else {
      return await selectSingleFileFromList(rl, files);
    }
  } catch (error) {
    console.log('Error reading directory.');
    const manualFile = await askQuestion(rl, 'Enter file path manually: ');
    return [manualFile];
  }
}

async function selectMultipleFilesFromList(rl, files) {
  console.log('Enter file numbers separated by commas (e.g., 1,3,5) or ranges (e.g., 1-3):');
  const fileIndices = await askQuestion(rl, 'File numbers: ');
  
  const selectedIndices = [];
  const parts = fileIndices.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      // Handle range (e.g., 1-3)
      const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
      for (let i = start; i <= end; i++) {
        selectedIndices.push(i - 1); // Convert to 0-based index
      }
    } else {
      // Handle single number
      selectedIndices.push(parseInt(trimmed) - 1); // Convert to 0-based index
    }
  }
  
  // Remove duplicates and filter valid indices
  const uniqueIndices = [...new Set(selectedIndices)].filter(
    index => index >= 0 && index < files.length
  );
  
  if (uniqueIndices.length === 0) {
    console.log('No valid file selections.');
    const manualFile = await askQuestion(rl, 'Enter file path manually: ');
    return [manualFile];
  }
  
  return uniqueIndices.map(index => files[index]);
}

async function selectSingleFileFromList(rl, files) {
  const fileIndex = await askQuestion(rl, '\nEnter file number: ');
  const selectedFileIndex = parseInt(fileIndex) - 1;
  
  if (selectedFileIndex >= 0 && selectedFileIndex < files.length) {
    return [files[selectedFileIndex]];
  } else {
    console.log('Invalid file selection.');
    const manualFile = await askQuestion(rl, 'Enter file path manually: ');
    return [manualFile];
  }
}

async function selectFilesImproved(rl) {
  console.log('📁 Enhanced File Selection');
  console.log('Choose files by entering their paths or browse current directory');
  console.log('Press Enter with no input when done selecting files.\n');
  
  const allFiles = [];
  let fileIndex = 1;
  
  while (true) {
    console.log(`\n📎 File ${fileIndex} selection:`);
    console.log('1. Enter file path directly');
    console.log('2. Browse current directory');
    console.log('3. Show currently selected files');
    console.log('(Press Enter with no input to finish selection)');
    
    const choice = await askQuestion(rl, '\nChoose option (1-3 or Enter to finish): ');
    
    // Empty input means we're done selecting files
    if (choice.trim() === '') {
      if (allFiles.length === 0) {
        console.log('⚠️  No files selected. Please select at least one file.');
        continue;
      }
      break;
    }
    
    if (choice === '1') {
      // Direct file path entry
      const filePath = await askQuestion(rl, 'Enter file path: ');
      if (filePath.trim() !== '') {
        if (fs.existsSync(filePath.trim())) {
          if (!allFiles.includes(filePath.trim())) {
            allFiles.push(filePath.trim());
            const stats = fs.statSync(filePath.trim());
            const size = (stats.size / 1024).toFixed(1) + ' KB';
            console.log(`✅ Added: ${path.basename(filePath.trim())} (${size})`);
            fileIndex++;
          } else {
            console.log('⚠️  File already selected.');
          }
        } else {
          console.log('❌ File not found. Please check the path.');
        }
      }
    } else if (choice === '2') {
      // Browse current directory
      try {
        const files = fs.readdirSync('.').filter(file => {
          const stats = fs.statSync(file);
          return stats.isFile() && 
                 !file.startsWith('.') &&
                 !['package.json', 'package-lock.json', 'node_modules'].includes(file);
        });
        
        if (files.length === 0) {
          console.log('No suitable files found in current directory.');
          continue;
        }
        
        console.log('\n📂 Files in current directory:');
        files.forEach((file, index) => {
          const stats = fs.statSync(file);
          const size = (stats.size / 1024).toFixed(1) + ' KB';
          const alreadySelected = allFiles.includes(file) ? ' ✅' : '';
          console.log(`${index + 1}. ${file} (${size})${alreadySelected}`);
        });
        
        const fileChoice = await askQuestion(rl, '\nEnter file number (or Enter to go back): ');
        if (fileChoice.trim() !== '') {
          const fileIdx = parseInt(fileChoice) - 1;
          if (fileIdx >= 0 && fileIdx < files.length) {
            const selectedFile = files[fileIdx];
            if (!allFiles.includes(selectedFile)) {
              allFiles.push(selectedFile);
              const stats = fs.statSync(selectedFile);
              const size = (stats.size / 1024).toFixed(1) + ' KB';
              console.log(`✅ Added: ${selectedFile} (${size})`);
              fileIndex++;
            } else {
              console.log('⚠️  File already selected.');
            }
          } else {
            console.log('❌ Invalid file number.');
          }
        }
      } catch (error) {
        console.log('❌ Error reading directory:', error.message);
      }
    } else if (choice === '3') {
      // Show currently selected files
      if (allFiles.length === 0) {
        console.log('📋 No files selected yet.');
      } else {
        console.log(`\n📋 Currently selected files (${allFiles.length}):`);
        allFiles.forEach((file, index) => {
          const stats = fs.existsSync(file) ? fs.statSync(file) : null;
          const size = stats ? (stats.size / 1024).toFixed(1) + ' KB' : 'File not found';
          console.log(`  ${index + 1}. ${path.basename(file)} (${size})`);
        });
        
        const removeFile = await askQuestion(rl, '\nRemove a file? Enter number or press Enter to continue: ');
        if (removeFile.trim() !== '') {
          const removeIdx = parseInt(removeFile) - 1;
          if (removeIdx >= 0 && removeIdx < allFiles.length) {
            const removedFile = allFiles.splice(removeIdx, 1)[0];
            console.log(`🗑️  Removed: ${path.basename(removedFile)}`);
            fileIndex--;
          } else {
            console.log('❌ Invalid file number.');
          }
        }
      }
    } else {
      console.log('❌ Invalid option. Please choose 1, 2, 3, or press Enter to finish.');
    }
  }
  
  console.log(`\n✅ File selection complete! Selected ${allFiles.length} file(s).`);
  return allFiles;
}

module.exports = {
  submitAssignment
};
