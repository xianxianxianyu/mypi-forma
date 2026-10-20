// Adapted from thesysdev/open-intelligent-ui, pinned in README.md. MIT; see LICENSE.
import { Box, Row, Col, Grid, Card, Divider, Spacer, Form } from './components/layout';
import { Title, Text, Caption, Label, Badge, List, ListItem, Markdown } from './components/text';
import { Button, IconButton, Pressable, Input, TextArea, Select, SegmentedControl, Slider, Checkbox, RadioGroup, DatePicker, Timer } from './components/controls';
import { Carousel, Popover, Code, Quote, MathBlock, Flashcard, Celebration } from './components/extra';
import { Chart } from './components/chart';
import { Table } from './components/table';
import { Icon } from './components/icon';
import { svgComponents } from './components/svg';

// No AgentInterface, HtmlView, external media, maps or URL-navigation component.
export const intelligentComponents = [
  Box, Row, Col, Grid, Card, Divider, Spacer, Form,
  Title, Text, Caption, Label, Badge, List, ListItem, Markdown,
  Button, IconButton, Pressable, Input, TextArea, Select, SegmentedControl, Slider, Checkbox, RadioGroup, DatePicker, Timer,
  Carousel, Popover, Code, Quote, MathBlock, Flashcard, Celebration,
  Chart, Table, Icon, ...svgComponents,
];
export { actions } from './actions';
export { functions } from './functions';
