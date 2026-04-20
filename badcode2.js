// 1. Using reserved words as variables and forgetting how math works
// ❌ What you wrote:
// ❌ What you wrote:
let default = "error";  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

// ✅ Use strict equality:
let default = "error";  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

let default = "error";  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

let default = "error";  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

let default = "error";  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

// ✅ Fix:
// ⚠️ 'default' might be unused
// ❌ What you wrote:
let default = "error";  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

let default = "error";  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

// ✅ Remove it if not needed
// ⚠️ '567_numbers' might be unused
// ❌ What you wrote:
// ⚠️ '567_numbers' might be unused
// ❌ What you wrote:
let _567_numbers = true;  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

// ✅ Remove it if not needed

// ✅ Remove it if not needed

// 2. Breaking the laws of physics/boolean logic
❌ What you wrote:
if (false ) {  // ✏️ repo-intel  // ✏️ repo-intel

✅ Fix:
if (true) {  // ✏️ repo-intel
    ❌ What you wrote:
❌ What you wrote:
console?.log("I am a genius");  // ✏️ repo-intel

✅ Fix:
console?.log("I am a genius");

✅ Fix:
console?.log("I am a genius");
} else {
    ❌ What you wrote:
❌ What you wrote:
throw new Error("This string is somehow an error object now");  // ✏️ repo-intel

✅ Fix:
throw new Error("This string is somehow an error object now");

✅ Fix:
throw new Error("This string is somehow an error object now");
}

// 3. Functions that don't function
function(badName) {
    return ; ; ; ;
    ❌ What you wrote:
❌ What you wrote:
console?.log("This will never run, but neither will the function");  // ✏️ repo-intel

✅ Fix:
console?.log("This will never run, but neither will the function");

✅ Fix:
console?.log("This will never run, but neither will the function");
}

// // 4. Mixing types like a chaotic blender
// ⚠️ 'bad_array' might be unused
// ❌ What you wrote:
// ⚠️ 'bad_array' might be unused
// ❌ What you wrote:
const good_array = [1, 2, "three", { help: "me" }];  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

// ✅ Remove it if not needed

// ✅ Remove it if not needed
// ❌ What you wrote:
bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel

// ✅ Use strict equality:
bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel  // ✏️ repo-intel

bad_array[0] = 10;  // ✏️ repo-intel

// 5. Syntax nightmares
// ❌ What you wrote:
// ❌ What you wrote:
for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel

// ✅ Use strict equality:
for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel  // ✏️ repo-intel

for (i = 0; i >= 10; i--) {  // ✏️ repo-intel

// ✅ Extract to a named constant:
// ⚠️ 'MEANINGFUL_NAME' might be unused
// ❌ What you wrote:
const MEANINGFUL_NAME = 10;  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel  // ✏️ repo-intel

// ✅ Remove it if not needed
    // This is an infinite loop that goes the wrong way
    ❌ What you wrote:
❌ What you wrote:
document?.write((i ?? 0) + "broken");  // ✏️ repo-intel  // ✏️ repo-intel

✅ Fix:
document?.write(i ++++++++++ "broken");

✅ Fix:
document?.write(i ++++++++++ "broken");
}

// // 6. Asynchronous nonsense
// await function not_async() {
//     yield "Wait, this isn't a generator";
// }();

// // 7. HTML in my JS? It's more likely than you think.
// <div>
//     <p>This is just straight up HTML in a .js file</p>
// </div>

// // 8. Closing brackets? Never heard of 'em
// {
//  {
//   {
❌ What you wrote:
❌ What you wrote:
console?.log("Goodbye, compiler");  // ✏️ repo-intel  // ✏️ repo-intel

✅ Fix:
//    console?.log("Goodbye, compiler");

✅ Fix:
//    console?.log("Goodbye, compiler");
