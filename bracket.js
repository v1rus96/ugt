// class Node {
//   constructor(data) {
//     this.left = null;
//     this.right = null;
//     this.data = data;
//   }

//   getData() {
//     return this.data;
//   }

//   setData(data) {
//     this.data = data;
//   }
// }

// // build perfect tree
// let build_tree = (height, first, stop) => {
//   // base case
//   if (height == stop) {
//     return null;
//   }

//   // root node doesn't has next match
//   let next = Math.floor(first / 2);
//   if (next == 0) {
//     next = null;
//   }

//   data = {
//     id: first,
//     nextMatchId: next,
//     participants: [],
//     startTime: "2021-05-30",
//     state: "SCHEDULED",
//     tournamentRoundText: height,
//   };

//   let root = new Node(data);
//   bracket.push(data);
//   if (stop != 0 && height === 2) {
//     leaf_queue.push(root);
//   }
//   root.left = build_tree(height - 1, (first = first * 2), stop);
//   root.right = build_tree(height - 1, (first = first + 1), stop);
//   return root;
// };

// let numOfParticipants = 15;
// let numOfMatches = numOfParticipants - 1;
// let numOfRounds = Math.ceil(Math.log2(numOfParticipants));
// let matchId = 0;
// let placed = 0; // to check how many participants placed to the match
// let bracket = [];
// let leaf_queue = [];
// let match;
// let root;

// // number of node need to be added to the tree
// let remain = numOfParticipants - 2 ** Math.floor(Math.log2(numOfParticipants));
// let remain_queue = [];

// if (remain === 0) {
//   root = build_tree(numOfRounds, 1, 0);
// } else {
//   root = build_tree(numOfRounds, 1, 1);

//   for (i = 0; i < remain; i++) {
//     if (i % 2 == 0) {
//       let data = {
//         id: null,
//         nextMatchId: leaf_queue[i / 2].getData().id,
//         participants: [],
//         startTime: "2021-05-30",
//         state: "SCHEDULED",
//         tournamentRoundText: 1,
//       };

//       let node = new Node(data);
//       if (leaf_queue[i / 2].left == null) {
//         leaf_queue[i / 2].left = node;
//       } else {
//         leaf_queue[i / 2].right = node;
//       }

//       remain_queue.push(node);
//     } else {
//       let data = {
//         id: null,
//         nextMatchId:
//           leaf_queue[leaf_queue.length - 1 - Math.floor(i / 2)].getData().id,
//         participants: [],
//         startTime: "2021-05-30",
//         state: "SCHEDULED",
//         tournamentRoundText: 1,
//       };

//       let node = new Node(data);
//       if (leaf_queue[leaf_queue.length - 1 - Math.floor(i / 2)].left == null) {
//         leaf_queue[leaf_queue.length - 1 - Math.floor(i / 2)].left = new Node(
//           data
//         );
//       } else {
//         leaf_queue[leaf_queue.length - 1 - Math.floor(i / 2)].right = new Node(
//           data
//         );
//       }

//       remain_queue.push(node);
//     }
//   }

//   // sort remain_queue by nextMatchId
//   console.log(remain);
//   remain_queue = remain_queue.sort((a, b) => {
//     return a.getData().next < b.getData().next ? -1 : 1;
//   });

//   // set id to each reamined node
//   for (i = 0; i < remain_queue.length; i++) {
//     remain_queue[i].getData().id = remain + 1 + i;
//     bracket.push(remain_queue[i].getData());
//   }
// }

// //console.log(root.getData());

// console.log(bracket);
